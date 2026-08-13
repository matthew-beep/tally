# User flows (as built)

Each flow lists the steps and the code that implements them. Query hooks are
in `src/queries/`, pages in `src/app/`, shared UI in `src/components/`.

## Auth & onboarding

1. Every request passes through the guard in `src/proxy.ts`:
   - no session and not a public path (`/login`, `/invite`, `/expense`,
     `/auth`) → redirect to `/login?redirect=<original>`
   - session but `profiles.handle IS NULL` → redirect to `/onboarding`
     (carrying `?redirect` so deep links survive first sign-in)
2. `/login` (`src/app/login/LoginButton.tsx`) — "Continue with Google" via
   `supabase.auth.signInWithOAuth`, plus a dev-only email/password form and
   one-tap dev login (`NEXT_PUBLIC_DEV_EMAIL`/`_PASSWORD`).
3. OAuth returns to `/auth/callback` (`src/app/auth/callback/route.ts`),
   which exchanges the code and forwards to the `next` param.
4. Signup fires the `handle_new_user` DB trigger → `profiles` row with
   `id = auth.users.id`, handle NULL.
5. `/onboarding` (`src/app/onboarding/page.tsx`) — pick an @handle with
   real-time availability check (`HandleInput`), saved lowercase via
   `useUpdateProfile`, then redirect to `?redirect` or `/`.
6. **Auth boundary = cache boundary**: `providers.tsx` watches
   `onAuthStateChange` and clears the whole TanStack cache whenever the
   session's user id changes (sign-out, expiry, user switch — compared by
   id, so token refreshes don't nuke the warm cache). `signOut()` on the Me
   page also clears explicitly, as insurance. Without this, account B was
   served account A's cached balances (found live 2026-07-19).

## Create a group

1. FAB / "New group" → `/groups/new` (`src/app/(dashboard)/groups/new/page.tsx`)
   — name, emoji, `MemberCombobox` to pre-add members (real users and
   free-text guests).
2. Submit → `useCreateGroup` (`useGroups.ts`) → `POST /api/groups/create`
   (`src/app/api/groups/create/route.ts`), which inserts:
   - the `groups` row,
   - creator as `group_members` `status: 'active'`,
   - searched users as `status: 'pending'` + `invited_by` (trigger notifies
     each invitee),
   - guests as `user_id: NULL`, `status: 'active'` (no profile, no
     notification).
3. Redirect to `/groups/:id`.

## Add members to an existing group

Three entry paths, one write path:

- **Search** — the inline add-member panel on `/groups/[id]`
  (`MemberCombobox` → `useSearchProfiles`, `useProfile.ts`) detects input
  mode: `@…` → handle fuzzy; 8-char alphanumeric → exact `add_code`; else
  name/display_name/handle fuzzy. Submit POSTs `/api/groups/members/add`.
- **Invite link** — `/invite/[token]` (`src/app/invite/[token]/page.tsx`).
  Clicking is consent, so joining is immediate (`status: 'active'`). The
  group-by-token lookup goes through `get_group_by_invite_token(token)`, a
  `SECURITY DEFINER` RPC (`20260811000000_get_group_by_invite_token.sql`) —
  not a direct `groups` table query. A direct query only works for visitors
  the existing RLS policies already recognize (members, creator, pending
  invitees), which excludes the exact case an invite link exists for: a
  stranger with zero prior relationship to the group. The RPC bakes the
  token match into the function body and returns only `(id, name, emoji)`,
  working identically whether or not the caller has a session yet. Getting
  the link: "Invite to group" in group settings (`InviteGroupSheet.tsx`)
  reads `groups.invite_token` off a group the member is already in — an
  ordinary read, no RPC needed — and offers copy + `navigator.share`.
- **QR / add code** — `/add/[add_code]` resolves a profile by `add_code`
  (`useProfileByAddCode`) and offers "add to group".

Writes go through `POST /api/groups/members/add`: real users upsert as
`pending` + `invited_by`; guests insert as active `user_id: NULL` rows.

**Accept / decline** (pending invitee, surfaced on the Me page and via the
`group_invite` notification):

- Accept → `useAcceptGroupInvite`: UPDATE to `active`; DB trigger notifies
  the inviter. Invitee now sees the group.
- Decline → `useDeclineGroupInvite` POSTs `/api/invite/decline`, which
  **always** converts the seat to a guest rather than deleting it:
  `UPDATE group_members SET user_id = NULL, status = 'active', invited_by = NULL`.
  Splits keep pointing at the same `group_members` row, so history and
  balances survive regardless of whether the pending invitee ever had any —
  branching on financial history was considered and rejected as unnecessary
  complexity (see the comment at the top of `src/app/api/invite/decline/route.ts`).
  The `on_group_member_updated` trigger (`20260729000000_wire_group_invite_notifications.sql`)
  sends `group_invite_declined` to the inviter, guarded so the conversion
  never also fires a false `group_invite_accepted`.

  Never DELETE a member row directly on decline — `expense_splits` cascade
  on member delete, which would silently corrupt balances.

**Pending members can be included in expenses.** `useGroupMembers` returns
`pending` + `active` on purpose — you can log a dinner split with someone
before they tap Accept. Pending gates their consent/visibility, not the math.
Because of that, pending members are visibly marked on group detail
(2026-07-19): "⏳ invited" pill in the members column, dimmed avatars in the
mobile strip, ⏳ in the empty-state preview.

## Claim a guest seat

**Status: built.** Two independent paths — self-serve and assisted — both
starting from a guest row in group settings (`MemberActionSheet.tsx`, guest
branch). See `docs/group-member-model.md` § Claiming for the schema and RLS
rationale; this section covers the UX.

A guest (`group_members` row with `user_id = NULL`) can become a real member
of that specific group without losing the expense history already attached
to their seat — `expense_splits`, `expenses.paid_by`, and `settlements`
already key off `group_members.id`, so claiming is a single write, not a
data migration.

### Path A — self-serve claim link

Tap a guest row → "Invite {name} to claim this spot" → the sheet shows
`/claim/:seat_token` with copy. `seat_token` is a DB column default on every
`group_members` row (same mechanism as `groups.invite_token`), and any active
member can read a fellow member's row (existing `group_members: members
only` policy), so no new read policy was needed to *get* the link.

`/claim/[token]` (`src/app/claim/[token]/page.tsx`):
1. `get_seat_by_claim_token(token)` — a `SECURITY DEFINER` RPC mirroring the
   invite-link fix above — resolves the token to `{group_id, group_name,
   group_emoji, seat_name, status}` where `status` is `'valid'` or
   `'already_claimed'`. Works pre-login; no row → `invalid` state client-side.
2. If valid and no session → `/login?redirect=/claim/:token`, same handoff
   `/invite/[token]` uses. New accounts land in onboarding first, then back
   here.
3. If valid and authenticated → confirm screen → `supabase.rpc('claim_seat',
   { token })`.

**Why the claim write is itself an RPC, not a plain client `UPDATE` under an
RLS policy** (unlike the invite-accept `UPDATE` in `/invite/[token]`, which
*is* a plain client write): Postgres RLS requires read access to a row before
an `UPDATE` policy is even consulted. An invite acceptee already has a
`group_members` row (inserted `pending` before they act), so the existing
"own row" policy grants visibility. A guest claimer has no row of their own —
the seat's `user_id` is still `NULL` — so no SELECT policy (members-only,
own-row) grants them visibility into it, and a same-shaped "self can claim"
RLS policy was verified against local Postgres to silently match zero rows:
not a security hole, but a dead flow indistinguishable from success (no
error, `.maybeSingle()` returns null, page reads "already claimed"). The
`claim_seat(token)` function (`SECURITY DEFINER`, `20260811010000_claim_flow.sql`)
does the `UPDATE ... WHERE seat_token = token AND user_id IS NULL AND status
= 'active'` internally, sets `user_id = auth.uid()` and the claimer's own
display name, and returns the seat's `id, group_id` on success (empty result
= already claimed or bad token). Granted to `authenticated` only, not `anon`
— unlike the preview RPC, claiming requires a session.

### Path B — assisted invite

Tap a guest row → "Link to a Tally account" → search (`useSearchProfiles`,
already-seated profiles filtered out) → pick → confirm screen → "Send
invite". This does **not** merge immediately. The member initiating it isn't
the one whose identity is being attached to the seat's financial history, so
it follows the same confirmation-required rule as any other search-based add
(CLAUDE.md's invite flow principle). `POST /api/groups/members/claim-invite`
(service-role, mirrors `/api/groups/members/add`'s privileged-write shape):
checks the caller is an active member, checks the target isn't already
seated in the group (friendly 409 instead of a raw `23505`), resolves the
target's own display name server-side (never trusts a client-supplied name
for someone else's row), then:

```sql
UPDATE group_members
SET user_id = :profileId, status = 'pending', invited_by = :caller, name = :targetName
WHERE id = :memberId AND group_id = :groupId AND user_id IS NULL;
```

This preserves the seat's `group_members.id` — expense/settlement history
stays attached — unlike a fresh `INSERT`. A new trigger,
`on_group_member_seat_invited` (`AFTER UPDATE`, `WHEN OLD.user_id IS NULL AND
NEW.user_id IS NOT NULL AND NEW.status = 'pending'`), reuses
`notify_group_invite()` unchanged to send the target a `group_invite`
notification. They accept/decline through the existing pending-invite flow —
`useAcceptGroupInvite`/`useDeclineGroupInvite` need no changes, since the
resulting row is shape-identical to a normal search-invite row.

### Shared

- **One guest, one outstanding claim at a time.** Once either path sets
  `user_id` on a seat, both paths' preconditions (`user_id IS NULL`) fail —
  Path A's RPC returns no row, Path B's route returns 404. The UI enforces
  this too: `settings/page.tsx` buckets members by status, and a
  `status: 'pending'` seat (set by Path B) moves out of the tappable `others`
  list into the read-only `pendingInvites` section, so there's no way to even
  open the guest-action sheet on it.
- **Security boundary is `WHERE user_id IS NULL`, not token secrecy after
  use.** `seat_token` is deliberately never nulled out on claim — a reused
  link reports "already claimed" instead of a generic error, at no cost to
  security, since a row with `user_id` already set can't match either path's
  precondition regardless of who holds the token.
- **Edge cases**: reused/already-claimed link → `already_claimed` state;
  claimer already has an active *or* `left` row in that same group → blocked
  by the `UNIQUE (group_id, user_id)` constraint, surfaced as "you're already
  connected to this group" rather than a raw DB error; invalid/unknown token
  → `invalid` state.
- **Explicit non-goal**: no cross-group guest identity. The same real person
  added as a guest in three different groups is three unrelated seats with
  three independent tokens — claiming one does not touch the others.

## Add an expense

1. `/groups/[id]` FAB or `/groups/[id]/add` → `AddExpenseSheet` /
   `AddExpenseForm` (`src/components/AddExpenseForm.tsx` — one component,
   separate mobile-sheet and desktop-modal renders sharing all state).
2. Description auto-detects a category emoji (`src/lib/categories.ts`,
   keyword match, tappable override).
3. Split modes: `equal` (toggle who's in), `exact`, `percentage` (both with a
   live balanced/remaining counter; on mobile the payer's share is the
   remainder and only *others* enter amounts), `itemized` (placeholder UI —
   nothing saved).
4. Save → `src/lib/splits.ts` builds `owed_amount` rows (rounding remainder
   to the first/payer row) → `useAddExpense` inserts the expense then its
   splits, and invalidates the per-group keys (`['expenses', gid]`,
   `['settlements', gid]`) — home/activity aggregates are derivations over
   those caches and recompute on their own.

## Expense detail / edit / delete

Tapping an expense row on the group page opens `ExpenseActionSheet`
(`src/components/ExpenseActionSheet.tsx` — the name predates the redesign) —
a three-screen bottom-sheet flow:

- **Detail** — the default screen. Emoji tile, description, who paid, the
  expense date, and an "(edited)" marker; then one row per participant
  showing that person's *net from this expense alone* (`+` fronted for
  others, `−` owes the payer), derived by `calcExpenseNets`
  (`src/lib/balance.ts`). The payer gets a row even when they hold no split
  of their own, which is why the net can't be written as
  `amount − amountPerHead`. Edit / Delete sit in a `ModalFooter` rather than
  being the point of the sheet — this is the surface expense reactions and
  comments land on (see
  [social-and-leaderboard-design.md](./social-and-leaderboard-design.md)).
- **Edit drawer** — amount, description, and payer are editable (dirty-field
  highlights, Save disabled until valid + dirty). *Split membership is
  read-only*; the payer picker only offers members already in the split.
  Save → `useUpdateExpense` (`useExpenses.ts`): rescales every
  `owed_amount` proportionally to the new amount (remainder → payer), then
  UPDATE expense + DELETE/re-INSERT splits. The `log_expense_edit` trigger
  snapshots the old row into `expense_history` automatically.
- **Delete confirm** — explains that balances for N people will be
  recalculated, then `useDeleteExpense` sets `deleted_at` (soft delete).

Feed rows show an "(edited)" tag where `updated_at != created_at` (group
detail + Activity tab). Still unbuilt: an edit-history viewer reading
`expense_history`.

## Balances & settle up

Balance pipeline (never stored, always derived):

1. `calcNetBalances(groupId, expenses, settlements, memberIds)`
   (`src/lib/balance.ts`) — net per `group_members.id`: payers gain others'
   `owed_amount`s, owers lose theirs; settlements shift from → to. Deleted
   expenses excluded; pending settlements included (optimistic).
2. Pairwise: `calcPairwiseNets(mySeatId, expenses, settlements)` — one
   member's per-counterparty map (positive = they owe me), the shape behind
   every "owes you / you owe" row; `summarizeBalances` folds it into
   `{ owedToMe, iOwe, net }` for hero numbers. This is the only debt model in
   the app — a greedy min-transfer algorithm (`simplifyDebts`) existed early
   on but is gone (see below), so a settle-up suggestion never names a
   counterparty you haven't actually split anything with.
3. Cross-group: `useGlobalBalances` runs the per-group pairwise in seat
   space, translates seats → profile ids, merges across groups, and takes
   hero grosses from `summarizeBalances` — so the home hero always equals
   the sum of the person rows. Pure derivation over the per-group caches
   (see data-loading-architecture.md).

Settle up — `SettleUpSheet` (`src/components/SettleUpSheet.tsx`), opened in
place from group detail (per-member row or header CTA) and, for cross-group
balances, from the home dashboard. It's a dumb, props-driven component: the
caller builds `Transfer[]` from `calcPairwiseNets` and hands it down; the
sheet does zero fetching or balance derivation itself. There is no dedicated
`/settle` route anymore — the old full-page `/groups/[id]/settle` (built on
`simplifyDebts`) was deleted 2026-08-02 once every entry point had migrated to
the sheet, and `simplifyDebts` was deleted with it (last caller gone; had no
other production use, only its own tests).

1. `ListDrawer` screen splits transfers into "Owed to you" / "You owe";
   tapping one opens `RecordPaymentDrawer` pre-filled with that transfer's
   amount (still editable — partial settlements just work).
2. `useCreateSettlements` writes the batch (see below). Rows count toward
   balances immediately whatever their status; the DB trigger notifies the
   counterparty (real users only — guests have no one to ask).
3. Payee confirms (`useConfirmSettlement` → status `confirmed`, trigger
   notifies payer) or denies (`useDenySettlement` → rows DELETEd, balance
   reverts, trigger notifies payer). Both act on the **whole batch**.

Partial settlements need no special handling — they're just amounts stacked
against the running balance.

### One payment, N settlement rows

Settlements are group-scoped (`group_id` is never null), so a single transfer
that zeroes balances in several groups has to write one row per group. Those
rows are the *allocation* of one payment, and `settlements.batch_id`
(`20260808000000`) is that payment's identity — universal, so a lone settlement
is a batch of one and there is no special case. `useCreateSettlements` is
correspondingly plural and group-unbound; `buildSettlementBatch`
(`src/lib/settlements.ts`) turns allocations into rows.

Two consequences worth internalizing:

- **Allocations are gross; the payment is net.** Owing $30 in Apartment while
  owed $20 in Big Sur means settle-all writes a $30 row and a $20 row — $50
  allocated — but only $10 actually changes hands. Each group must zero at its
  own full balance, so the rows cannot be netted against each other.
- **Confirmation status belongs to the payment, not the row.** It is set once,
  from the sign of the batch's net, and is uniform across the batch: a batch
  netting to *I paid you* is self-serving and lands `pending` (the payee is
  asked to confirm **the net**); one netting to *you paid me* costs the
  recorder, so it lands `confirmed` with an informational
  `settlement_recorded` to the other party. Per-row status would ask a payee
  to vouch for a $40 transfer when $20 was sent.

Confirm and deny therefore act on every row at once (`.in('id', ids)`) — one
transfer either arrived or it didn't, and you cannot half-receive $45. Deny
deletes the offsetting rows too; they only existed as part of that netting.

Balance math is untouched by any of this: the invariant counts settlements with
`status IN ('pending','confirmed')` — i.e. all of them — so status has never
affected a balance, and moving it up to payment level doesn't reach
`calcPairwiseNets` / `calcNetBalances`.

## Notifications & activity

Two separate systems:

- **Notifications** (stored; action-required): written *only* by DB triggers.
  Read via `useNotifications` (unread only). Invite accept/decline and
  settlement confirm/deny actions live on the Me page
  (`src/app/(dashboard)/me/page.tsx`), home's `NeedsAttentionRail`, and — since
  2026-08-12 — `NotificationsSheet`, opened from the `NotificationBell` that
  `AppHeader` puts on every tab page and the group-detail header mounts for
  itself.

  The group name/emoji a settlement card shows comes from
  `settlement.group`, not `notification.group`: `notify_settlement_created()`
  leaves `notifications.group_id` NULL (only invite rows get one), so the
  top-level join resolves null for every settlement type and the settlement's
  own `group_id` is the only source. `useNotifications` embeds both;
  `SettlementReview` reads the nested one and falls back to `💸`/"Group" —
  which is what `settlement_denied` gets, since it carries no `settlement_id`
  to join through at all (see below). Fixed 2026-08-12; before that, every
  settlement card rendered the fallback.

  **Grouped client-side into one card per payment.** The triggers are
  `FOR EACH ROW`, so an N-group batch emits N notifications; `groupNotifications`
  (`src/lib/notifications.ts`) collapses them by `batch_id` into
  `NotificationBatch[]`, and the hook returns those rather than raw rows.
  Grouping is client-side by design: a statement-level trigger emitting one
  notification per batch could use neither `notifications.settlement_id` (it
  would point at N rows) nor an FK to `settlements.batch_id` (not unique), which
  would break the PostgREST embed the read path depends on.

  The grouping key is `notifications.batch_id`, stamped by the triggers rather
  than joined through `settlement_id` — `settlement_denied` carries no
  `settlement_id` at all (the row is deleted before the `AFTER DELETE` trigger
  fires, and the FK would reject it), so the join would fail for exactly the
  case grouping most needs to handle. Denied batches fall back to
  `notifications.amount` and report no direction, since the seats that carried
  it are gone.
- **Activity** (derived; history): `mergeFeed` (`src/lib/feed.ts`) merges
  expenses + settlements into one `created_at`-sorted timeline; the group
  page buckets it by month, `useAllActivity` by group. No events table, no
  activity queries of their own — both derive from the per-group caches.
