# Balances

Who owes whom, and how much. This domain owns **no tables** — every number here
is derived on read from `expense_splits` and `settlements`.

> **Doc scope.** This is a *derivation* doc: it owns math, not schema. There is
> no "tables owned", no RLS, and no write path, because balances are never
> written. The tables it reads are owned by [expenses.md](./expenses.md) and
> [settlements.md](./settlements.md); where the caches live is
> [data-loading-architecture.md](../data-loading-architecture.md).

---

## 1. What it is — and what it isn't

The balance layer answers three different questions, and conflating them is the
main way this goes wrong:

| Question | Function | Shape |
|---|---|---|
| What is each member's position in this group? | `calcNetBalances` | seat → signed number |
| What is *my* position with each person I've split with? | `calcPairwiseNets` | counterparty seat → signed number |
| What do I owe / am I owed, in total? | `summarizeBalances` | `{ owedToMe, iOwe, net }` |

What it is **not**:

- **Not stored.** No cached balance column, no materialized view, no
  denormalized total. Every number recomputes from rows on read.
- **Not debt-simplified.** Tally does not run min-transfer matching — see §7.
- **Not a per-expense breakdown.** `calcExpenseNets` looks like a balance and
  isn't; it deliberately ignores settlements and every other expense. It exists
  for the expense detail sheet only.
- **Not gated on confirmation.** A pending settlement moves balances exactly as
  much as a confirmed one.

---

## 2. Inputs

Everything derives from two per-group caches plus the member list:

```
['expenses', gid]      → Expense[]  (each with .splits, .paid_by)
['settlements', gid]   → Settlement[]
['group_members', gid] → GroupMember[]   (supplies the seat universe + seat→profile)
```

Two properties of the inputs the math depends on:

- **Splits sum exactly to `expenses.amount`**, with the rounding remainder
  assigned to the payer. Enforced in `src/lib/splits.ts` before the INSERT, never
  in the DB. If this is ever violated, group nets stop summing to zero.
- **Soft-deleted expenses are still in the cache.** The SELECT policy must *not*
  filter `deleted_at IS NULL` (or the soft-delete UPDATE rejects its own result
  row), so exclusion is the balance layer's job — see `isLive` below.

---

## 3. Invariants

1. **Balances are computed, never stored.**
2. **Group nets sum to zero.** Across a whole group, `calcNetBalances` must total
   0 — every dollar owed is a dollar owed *to* someone. Tested against a messy
   history.
3. **Pairwise and net agree.** For every member,
   `summarizeBalances(calcPairwiseNets(me, …)).net === calcNetBalances(…)[me]`.
   This is the load-bearing consistency check between the two entry points, and
   it has its own test block.
4. **Soft-deleted expenses are invisible**, via the single `isLive` predicate —
   one predicate so the two entry points can't drift.
5. **Both settlement statuses count** (`pending` and `confirmed`).
6. **Money is rounded to cents at every boundary** — `Math.round(x * 100) / 100`
   / `round2`. Floats never reach the UI.
7. **Sub-cent positions are settled.** Anything within ±0.01 is treated as zero
   by `summarizeBalances`.
8. **The pure functions operate in seat space.** Seat → profile translation
   happens *between* layers, never inside them.

---

## 4. The functions (`src/lib/balance.ts`)

### `isLive(expense): boolean`

The soft-delete invariant, in one place.

```ts
return !e.deleted_at
```

Truthiness rather than `=== null`, deliberately: a partially-selected row can
carry `undefined` here, and `=== null` would wrongly treat it as *not* deleted.

### `calcNetBalances(groupId, expenses, settlements, memberIds) → Record<seatId, number>`

Every member's signed position in one group. Positive = owed to them.

- Seeds every member at 0, so a member with no activity appears as `0` rather
  than being absent.
- For each split: credits `paid_by`, debits the split holder — **skipping the
  payer's own split row**, since owing yourself is not a debt.
- Settlements shift the net from → to.
- Filters by `group_id` internally, so passing a mixed array is safe.

### `calcPairwiseNets(mySeatId, expenses, settlements) → Record<seatId, number>`

One member's position with each counterparty. Positive = they owe me.

This is the shape behind **every** "owes you / you owe" row in the app. Note the
asymmetry with `calcNetBalances`: this one takes no `groupId` and no member list,
because the caller has already scoped the arrays and the key space is "people I
actually transacted with" — not the group roster. Someone you never split with
never appears, which is the whole point (§7).

### `summarizeBalances(pairwise) → { owedToMe, iOwe, net }`

Collapses a pairwise map into hero numbers. `owedToMe` and `iOwe` are **gross
magnitudes, both positive**; `net = owedToMe − iOwe`. Entries within ±0.01 are
skipped as settled.

**No `Math.max(0)` floors.** An overshooting settlement flips a person into the
other column rather than being clamped — which is what keeps the hero equal to
the sum of the person rows underneath it. There is a test for exactly this.

### `calcExpenseNets(expense, memberOrder?) → ExpenseNet[]`

One expense's effect on each participant, **from that expense alone**. Not a
balance: settlements and every other expense are deliberately absent.

Two subtleties, both load-bearing:

- **The payer always gets a row**, even when they hold no split of their own
  (they paid for a meal they didn't eat). This is why the calculation can't be
  written as the obvious `amount − amountPerHead`.
- **`memberOrder` keeps row order — and therefore avatar colour slots —
  consistent** with every other screen. Participants missing from the group list
  (e.g. a removed seat) sort *last* rather than jumping to the front on
  `indexOf`'s `-1`.

---

## 5. Composition — where each runs

```
['expenses', gid] + ['settlements', gid] + ['group_members', gid]
    │
    ├── group detail ──── calcNetBalances (seat space) ─────→ member rows
    │                     calcPairwiseNets(mySeat) ─────────→ "owes you / you owe"
    │                                       └→ summarizeBalances → group hero
    │
    ├── expense sheet ─── calcExpenseNets ──────────────────→ per-person detail
    │
    └── useGlobalBalances ── per-group calcNetBalances + calcPairwiseNets
                             → translate seat → profile at the merge
                             → summarizeBalances(mergedPairwise) → home hero
```

`useGlobalBalances` (`src/queries/useGlobalBalances.ts`) is a **derivation with no
cache key of its own** — a `useMemo` over `useAllGroupData`. Mutations invalidate
the per-group keys and this recomputes automatically. It returns `net`,
`netPerGroup`, `pairwisePerGroup`, `grossOwedToMe`/`grossIOwe`, plus `profileMap`
/ `membersPerGroup` / `groupMap` for rendering.

`profileMap` comes from the members join — there is no profiles query.

### Identity translation, which happens here and only here

Money is seat-keyed (`group_members.id`); cross-group aggregation is
person-keyed. The fold resolves it with:

```ts
const effectiveId = (gmId) => gmMap[gmId] ?? gmId   // seat → user_id, or seat if guest
```

Real users fold to their profile id and aggregate across groups; **guests keep
their seat id** and stay scoped to the one group they exist in. That is correct —
a guest is a seat, not a person, and two guest seats in two groups are not
knowably the same human.

The consequence for callers: `personId` in cross-group code is *not consistently
one kind of id*. Writing money back therefore needs `resolveSeatId(gb, groupId,
personId)`, which tries both `user_id` and `id` for exactly this reason.

---

## 6. How it's guarded

`src/lib/balance.test.ts` is the safety net for the whole domain — the functions
are pure, so this is cheap and complete. Coverage worth knowing about:

- **Consistency**: `summarize(pairwise(me)).net === calcNetBalances[me]` for
  *every* member, over a shared fixture.
- **Zero-sum**: nets sum to zero across a messy history.
- **Soft delete**: excluded from both entry points, separately.
- **Cross-group leakage**: expenses and settlements from other groups ignored.
- **Settlements**: both directions, pending included, partials stacking.
- **Float**: accumulated error rounds to cents.
- **No flooring**: gross columns don't clamp at zero when a settlement
  overshoots.
- **Epsilon**: sub-cent residue reads as settled.

If you change any function here, the consistency test is the one that matters —
it's what stops the two entry points from disagreeing about the same person.

---

## 7. Decisions

### Pairwise nets, not debt simplification

Tally does **not** run min-transfer matching. `calcPairwiseNets` computes, from
one member's perspective, their net with each person they *actually transacted
with* — never inventing a transfer between two people who never shared an
expense.

A greedy `simplifyDebts` was built and tested early on but only ever shipped
behind a single route (`/groups/[id]/settle`). Removed 2026-08-02 once every
settle-up entry point had converged on the pairwise model; the route and the
function went together.

The concrete bug this closes: the old settle sheet's list screen used group-wide
minimum-transfer matching while the balance card right above it showed direct
pairwise nets — two different numbers for the same person on one screen. Now a
"you owe $12" never points at someone you've never split anything with.

### Balances are computed, never stored

The reason is that the inputs are mutable in ways a cached total can't track:
expenses are edited and soft-deleted, settlements are denied and deleted, members
convert to guests. Every one of those would need a cache-invalidation path, and
each is a chance to leave a stale number in front of a user who is trying to
settle a real debt. Recomputation is cheap at realistic history sizes.

### Pending settlements count toward balances

Optimistic by design: the balance reflects reality the moment a payment is
recorded, and confirmation is a *trust* signal (⏳), not a ledger event. This is
also why the balance layer never reads `status` at all — see
[settlements.md](./settlements.md) §3.

### Aggregates are computed, never stored either

The cross-group layer extends the same principle: there is no cached
cross-group object and no aggregate cache key. The dashboard's numbers are
`useMemo` folds over whatever per-group entries the screen subscribes to. That is
what removed a whole bug class of "which aggregate key do I invalidate?"

---

## 8. Known gaps

| Gap | State |
|---|---|
| **The canonical caches can never be paginated** | Client-side balance math needs complete history. When history size hurts (payload/recompute, not query time), the exits are: move balances server-side (an RPC/view mirroring these functions, tested against them), and make the feed a separate paginated `UNION ALL`. Both slot in per-surface without changing the architecture. |
| **Sub-cent residue in `buildPeopleFlow`** | `net` sums all per-group entries while `parts` filters at `>= 0.01`, so the home hero can disagree with the by-group rows and settle-all wouldn't strictly zero the person. Invisible in dollars; left alone because fixing it changes displayed numbers. |
| **`AllSquare` copy** | With one counterparty you're net-square with, home renders "All square" while their group still shows an open balance to every member of it. Consistent if home is read as net-framed, confusing otherwise. Copy-only. |
| **Net-zero people are gated off the dashboard** | `buildPeopleFlow` skips anyone whose net rounds under a cent. Decided, not a bug: their groups stay settleable from each group's own page, and the gate is what keeps the settle-status sign test total. Accepted consequence: group deletion and member removal block on a balance the dashboard says doesn't exist. |
| **Left members** | Historical splits stay in the math (that's the point of preserving the row), but `'left'` seats are excluded from the live balance UI. There is no dedicated "former member owes you" surface. |
| **`CLAUDE.md` is stale here** | Its `calcNetBalances` sketch is profile-keyed and predates the seat model, and it still describes debt simplification as part of settling up. |
