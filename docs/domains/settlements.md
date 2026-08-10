# Settlements

Recording, confirming, and denying payments between members — data model, read
path, write paths, and the reasoning behind the shape.

> **Doc scope.** Complete DDL lives in [schema.md](../schema.md); this doc carries
> only the columns that carry meaning, with the reasoning. Cross-domain journeys
> stay in [flows.md](../flows.md); the cache model is in
> [data-loading-architecture.md](../data-loading-architecture.md).

---

## 1. What it is — and what it isn't

A settlement records that **money moved between two people**. It is a payment
against a *balance*, not against an expense.

- **Not tied to expenses.** No `settlement_id` on `expense_splits`, no allocation
  of a payment to particular expenses. This is exactly what makes "partial
  settlements just work": a $10 settlement against a $15 balance leaves $5, and
  nothing has to decide *which* $10 of the $15 got paid.
- **Not a balance mutation.** Balances are derived ([balances.md](./balances.md)).
  A settlement is one more input row, never a write to a stored total.
- **Not a dispute record.** There is no disputed state. Denial is a `DELETE`.
- **Group-scoped and seat-keyed.** `group_id` is never NULL, and both endpoints
  FK `group_members`, not `profiles`.
- **A payment is not a settlement.** One transfer that zeroes balances in three
  groups is one payment written as three settlement rows — see §7 (c).

---

## 2. Tables owned

`settlements` is the only table this domain owns. It writes `notifications`
through triggers (owned by [notifications.md](./notifications.md)) and reads
`group_members` for seats.

| Column | Why it exists |
|---|---|
| `group_id` | Settlements are group-scoped. Never NULL — a payment spanning groups writes one row per group rather than one unscoped row. |
| `from_member_id` / `to_member_id` | → `group_members.id` (the *seat*), not `profiles.id`. A person holds a different seat in every group, and a guest has a seat with no profile at all. |
| `amount` | `numeric(10,2)`, `CHECK (amount > 0)`. Always positive — direction is carried by which seat is `from` vs `to`, never by sign. |
| `status` | `'pending' \| 'confirmed'`. A *trust* indicator, never a ledger gate — both count toward balances. Uniform across a batch; see §7 (a′). |
| `batch_id` | `NOT NULL DEFAULT gen_random_uuid()` (`20260808000000`). The identity of the *payment* these rows allocate. Universal, so a lone settlement is a batch of one and no "is this batched" branch exists anywhere downstream. |
| `settled_date` | When the payment happened (user-set). |
| `created_at` | When it was recorded. **This is the activity sort key**, not `settled_date`. |
| `note` | Free text, per payment — applied to every row in a batch. |

Indexes: `idx_settlements_group` on `group_id`; `batch_id` indexed by
`20260808000000`.

---

## 3. Invariants

1. **Both statuses count toward balances.** The balance invariant sums
   settlements with `status IN ('pending','confirmed')` — i.e. all of them.
   Confirmation has never affected a balance. Recording moves the number
   immediately; ⏳ only signals that assent is outstanding.
2. **Amounts are positive; direction lives in the seats.** Never encode
   direction as a negative amount.
3. **Status is uniform within a `batch_id`.** Set once from the sign of the
   batch's net (`batchStatus`). Nothing may set one row's status independently.
4. **Confirm and deny act on the whole batch**, never a subset. You cannot
   half-receive a transfer.
5. **Allocations are gross; the payment is net.** The rows sum to more than the
   money that moved whenever a batch mixes directions. Both figures are real;
   neither alone is honest in the UI.
6. **Sub-cent allocations are dropped, not written.** `amount > 0` would reject a
   `$0.00` row and abort the whole multi-row INSERT alongside the real
   allocations. Status is computed from the *surviving* rows, so dropped residue
   can never flip the sign.
7. **Denial deletes; it never marks.** There is no `denied` status and no soft
   delete on settlements (unlike expenses).

---

## 4. Read path

`settlementsQueryOptions(groupId)` (`src/queries/useSettlements.ts`), key
`['settlements', groupId]`, shared by `useSettlements` (single group) and the
`useAllGroupData` fan-out so both read and write the same cache entry. Each row
comes back with both seats embedded, each with its profile:

```
settlements
  from_member:group_members!from_member_id(… profile:profiles!group_members_user_id_fkey)
  to_member:group_members!to_member_id(…)
```

FK hints are required — `settlements` has two FKs to `group_members`, and
`group_members` has two to `profiles` (`user_id`, `invited_by`).

**There is no cross-group settlements query.** Everything cross-group is a pure
fold over the per-group caches:

| Consumer | File | What it does with settlements |
|---|---|---|
| `calcNetBalances` | `lib/balance.ts` | Shifts net from → to, per seat |
| `calcPairwiseNets` | `lib/balance.ts` | One member's per-counterparty map — the shape behind every "owes you / you owe" row |
| `useGlobalBalances` | `queries/useGlobalBalances.ts` | Per-group pairwise in seat space → translate seat → profile → merge across groups |
| `mergeFeed` | `lib/feed.ts` | Merges with expenses into one `created_at`-sorted timeline |
| `useNotifications` | `queries/useProfile.ts` | Reads settlements *through* `notifications`, not from this cache |

That last row matters: the notification list embeds settlements via
`notifications.settlement_id` rather than reading `['settlements', gid]`, because
a recipient gets notified about groups whose settlement cache they may never have
loaded.

---

## 5. Write paths

All three mutations live in `src/queries/useSettlements.ts`, and all three loop
the batch's distinct `group_id`s on invalidation. A payment can span groups, and
activity, the home rail and `useGlobalBalances` derive from those per-group caches
with no keys of their own, so that loop covers every surface.

### 5.1 Create — `useCreateSettlements`

Plural and group-unbound. **There is no singular variant**: for one row,
status-from-batch-net and status-from-direction are byte-identical, and keeping
both would put the §7 (a′) rule in two places, which is how they drift.

```
SettleUpSheet / BalanceSheet
  → SettlementAllocation[]     { groupId, mySeatId, theirSeatId, amount, direction }
  → buildSettlementBatch(allocations, { batchId: crypto.randomUUID(), note, settledDate })
      · drops allocations < $0.01
      · batchStatus(live) → one status for every row
      · direction → from/to seat swap
  → supabase.from('settlements').insert(rows)      ← one atomic multi-row INSERT
  → AFTER INSERT trigger per row → notifications
  → invalidate ['settlements', gid] × distinct groups, ['notifications']
```

Two things that look like details and aren't:

- **`batchId` is generated in the hook, not left to the column default.** The
  default is per-row; relying on it would give every row in a batch a different
  uuid and silently split one payment into N batches of one.
- **A multi-row Supabase insert compiles to one SQL `INSERT`** — all rows or
  none — so a batch can never land half-written. No transaction-wrapping RPC
  needed.

Pure logic lives in `src/lib/settlements.ts` (`batchNet`, `batchStatus`,
`buildSettlementBatch`), covered by `settlements.test.ts` — 22 tests, including
the `+$50 / −$10` case that inverts the rejected "any row pending → batch
pending" rule.

### 5.2 Confirm — `useConfirmSettlement`

Takes `{ settlementIds, groupIds, notificationIds }` and runs two statements
**sequentially, not in parallel**:

1. `UPDATE settlements SET status='confirmed' WHERE id IN (…)` → fires
   `notify_settlement_confirmed` per row.
2. `UPDATE notifications SET read=true WHERE id IN (…)`.

Sequential because marking the request read is only correct if the settlements
actually got confirmed. Run in parallel, a rejected UPDATE (RLS allows the payee
only) still retires the card, leaving the settlements pending with nothing left
in the UI to act on them.

Confirm needs the explicit read-marking because the row *survives* — unlike deny,
where the cascade handles it.

### 5.3 Deny — `useDenySettlement`

`DELETE FROM settlements WHERE id IN (…)` — the whole batch, including any
offsetting rows, which only ever existed as part of that netting. The balance
reverts on its own because deleted rows stop feeding the fold. Notifications
cascade (`settlement_id REFERENCES settlements ON DELETE CASCADE`), so no
read-marking is needed.

> **The error check here is load-bearing.** This DELETE failed on every attempt
> from the day it was written until `20260805010000` (the trigger's FK
> violation), and nothing noticed precisely because the error was dropped —
> PostgREST returns it in `error` rather than throwing.

### 5.4 Not built

Deleting a *confirmed* settlement. `useDenySettlement` only ever targets pending
rows from the `/me` deny flow. See §8.

---

## 6. Triggers & RLS

### Triggers — the app never writes `notifications`

| Trigger | Event | Effect |
|---|---|---|
| `notify_settlement_created` | AFTER INSERT | **Branches on `NEW.status`** (`20260805000000`): `pending` (debtor recorded — "I paid you") → `settlement_confirm` to the payee, action-required; `confirmed` (creditor recorded — "you paid me") → `settlement_recorded` to the payer, informational. |
| `notify_settlement_confirmed` | AFTER UPDATE pending→confirmed | `settlement_confirmed` → payer |
| `notify_settlement_denied` | AFTER DELETE of pending | `settlement_denied` → payer. **Sets no `settlement_id`** — the row is already gone and the FK would reject it (`20260805010000`); `amount` and `batch_id` are read off `OLD` instead. |

Three things worth internalizing:

- **Status carries the direction of the claim**, which is why no `recorded_by`
  column is needed.
- **All three stay `FOR EACH ROW`** and stamp `NEW`/`OLD.batch_id` onto the
  notification. An N-group batch produces N notification rows sharing one
  `batch_id`; the client collapses them. Grouping is client-side by design —
  §7 (e).
- **Recipients resolve via `group_members.user_id`** and are skipped for guests
  in every branch — there is nobody to ask.

### RLS (`20260721000000_baseline_schema.sql`)

| Policy | Rule |
|---|---|
| `settlements: group members only` (SELECT) | `group_id IN (SELECT get_my_group_ids())` |
| `settlements: group members can insert` (INSERT) | same |
| `settlements: payee can update` (UPDATE) | `to_member_id` is one of my seats — **only the payee can confirm** |
| `settlements: parties can delete` (DELETE) | `from_member_id` **or** `to_member_id` is one of my seats |

`get_my_group_ids()` is `SECURITY DEFINER` and filters `status = 'active'`.

> **Correction of record (2026-08-08):** TODO.md item 1 and item 5 phase 3 both
> claimed DELETE was unrestricted and needed a migration. It isn't and doesn't —
> `settlements: parties can delete` has been in the baseline all along and
> already implements exactly the permission that was "decided." The
> `review-todo.md` RLS audit flagging only UPDATE was read as "DELETE is open"
> when it meant "DELETE was already fine."

---

## 7. Decisions

Worked out 2026-08-03 → 08-09. The full deliberation, with sequencing and
implementation checklists, is TODO.md item 5; this is the settled model.

### (a) Confirmation status is directional

The test is not *who initiated it* but **does my claim improve my own financial
position?**

| What I record | Status | Counterparty gets |
|---|---|---|
| I owe you → I paid you | `pending` | Confirm request (action) |
| You owe me → you paid me | `confirmed` | FYI (`settlement_recorded`) |

Claiming I paid a debt is self-serving, so it needs the payee's assent. Claiming
someone paid me *removes* money owed to me — it costs me, not them, so there is
nobody to protect. They are still told, because their balance moved.

### (a′) …and status belongs to the payment, not the allocation

Applying (a) per row breaks on mixed-direction batches. Apartment (Alex owes me
$20), Big Sur (I owe $25), Dinner (I owe $15): per-row status gives two pending
rows summing to $40, so Alex is asked to vouch for a $40 transfer when the money
actually sent is the **net $20**.

Fix: compute the net across the batch and let its sign set the status for every
row. Net-zero → `confirmed` (no money moves, so there is nothing to assent to;
unreachable from the UI today because the dashboard gates out net-zero
counterparties, but defined rather than left to fall out of a sign test).

**Rejected: "any row pending → batch pending."** Agrees with net-direction in the
common case but inverts in one: Apartment (Alex owes me $50) + Big Sur (I owe
$10) nets to Alex paying me $40, yet has a pending row — so that rule would ask
Alex to confirm a payment Alex is *receiving credit for*.

### (b) Settle-all zeroes every group; it does not settle the net

Directions differ per group routinely. Settle-all settles each group at its own
full balance, so **allocations are gross**: owe $30 in Apartment, owed $20 in Big
Sur → two rows, $50 allocated, $10 actually moving.

Settling the net was rejected twice over: it cannot be expressed (settlements are
group-scoped, so zeroing both groups requires touching both), and it would leave
balances open after an action called "settle all."

The review screen must show **both** — gross per direction and the net transfer.
Net alone hides that two groups are being zeroed; gross alone implies $50 changes
hands when $10 does.

### (c) A payment is not a settlement

One transfer of $45 is one payment; the settlement rows are its allocation across
groups. Payment identity is carried as a **stamp, not a table** (`batch_id`).

`NOT NULL DEFAULT` rather than nullable-when-standalone: nullable is cheaper in
the migration and more expensive everywhere downstream — notification grouping,
the confirm mutation, and card copy would each need an "is this batched" branch.
Universal means the single case is the degenerate version, not a special case.
Existing rows backfilled for free, each becoming its own batch, which is what they
were.

Forward-compatible: if a real `payments` table is ever wanted (the natural home
for `method`/`note`/`paid_date`), `batch_id` becomes the FK and nothing built now
is thrown away.

### (d) No partial confirm

Earlier sketches had an expandable card letting the payee confirm one group and
deny another. That models something physically impossible — one transfer either
arrived or it didn't. If the payer really did pay per group, they settle per
group (the group-page `SettleUpSheet` path), producing separate batches, so the
action boundary and the payment boundary line up by construction.

### (e) Notification grouping is client-side

Triggers are `FOR EACH ROW`, so an N-group batch emits N notifications.
`groupNotifications` (`src/lib/notifications.ts`) collapses them into
`NotificationBatch[]`, and `useNotifications` returns those rather than raw rows.

**Rejected: a statement-level trigger** with a transition table emitting one
notification per INSERT. It matches the model exactly, but the read path breaks —
a notification pointing at N settlements can use neither
`notifications.settlement_id` nor an FK to `settlements.batch_id` (not unique),
so the PostgREST embed the read path depends on stops working. Doing it properly
wants a `settlement_batches` table both sides FK to.

**The grouping key is `notifications.batch_id`, stamped by the trigger** — not
joined through `settlement_id`. `settlement_denied` carries no `settlement_id` by
construction, so the join would fail for exactly the case grouping most needs to
handle. Denied batches fall back to `notifications.amount` and report no
direction, since the seats that carried it are gone.

Two grouping details, both tested: batch-less rows key on `single:${id}` rather
than `null` (keying on `batch_id` alone would collapse every pending group invite
into one card), and direction is resolved by comparing seats' `user_id` to the
auth user rather than by seat id — notifications are profile-keyed while
settlements are seat-keyed, so the recipient holds a different `group_members.id`
in every group of a batch.

### (f) Every settlement notifies the counterparty

No direction is silent. The type differs, the delivery doesn't. The FYI is
dismiss-only by design — nothing to approve, but the recipient's balance moved,
so silence isn't an option. "Dismiss" is the existing `read` flag.

`settlement_recorded` got its own type rather than reusing `settlement_confirmed`:
reuse would render "Alex confirmed your payment ✓" and "Alex marked you as
settled" as one type, forcing the label to re-derive which event it was from the
settlement row.

### Group feed shows settlements plainly

Rejected: "Matthew paid Alex $30 · part of a $45 payment". The group feed is
visible to *every* active member, so that leaks to bystanders that Matthew and
Alex have business in a group they can't see. "Matthew settled $30 with Alex" is
complete and true within that group's ledger.

### Cross-group affordance on the group page — declined, not deferred

Considered nudging "Alex owes you $40 in Big Sur — settle both and no money needs
to change hands" when settling in a group with an offsetting balance elsewhere.
Dropped because the per-group ledgers are already correct; cross-group netting is
a convenience that belongs on the dashboard, where you've explicitly asked for a
person-level view. This is what keeps `SettleUpSheet` group-scoped and keeps
`Transfer` from having to absorb `groupId`/`mySeatId`.

---

## 8. Known gaps

| Gap | State |
|---|---|
| **Dashboard settle CTAs unwired** | `BalanceSheet`'s settle-all and `GroupSettleScreen` buttons are still `onClick={() => {}}`. The write path exists and is tested; nothing calls it from the dashboard yet, so **no multi-row batch can be created in the app today**. |
| **Settle-all review screen shows the wrong figure** | Currently `Math.abs(net)`. Per (b) refined by (a′) it must show gross per direction *and* the net transfer. |
| **Batch card renders the single-settlement layout** | `SettlementConfirmCard` *acts* on the full batch correctly but doesn't yet render the batch shape (net headline, one line per group, offsetting rows marked). Deferred so it gets written once, in the notification center. Unreachable until the CTAs are wired. |
| **Unread count query doesn't exist** | Nothing polls the bell today. Must count **distinct non-null `batch_id` plus rows where it is NULL** — `batch_id` is NULL for `group_invite*` types, so a bare `count(distinct batch_id)` would collapse every pending invite into one. |
| **Delete a confirmed settlement** | No `useDeleteSettlement`, and settlement rows in the group feed aren't tappable at all (unlike the expense rows directly above them). This is the *only* remedy for a wrongly recorded "you paid me," since that path skips confirmation. RLS already permits it. |
| **Sub-cent residue in `buildPeopleFlow`** | `net` sums all per-group entries while `parts` filters at `>= 0.01`, so the hero can disagree with the by-group rows and settle-all wouldn't strictly zero the person. Invisible in dollars; left alone because fixing it changes displayed numbers. |
| **Net-zero counterparties hidden from the dashboard** | Decided, not a bug — their groups stay settleable from each group's own page, and the gate is what keeps (a′)'s sign test total. Accepted consequence: `DeleteGroupSheet` and member-removal block on a balance the dashboard says doesn't exist. |
| **`CLAUDE.md` is stale here** | Its notification type list predates `settlement_recorded`, and its cross-group section still calls settlement "UI aggregation, not a data model change" with each group generating its own confirmation notification. (b)–(f) override both. |
