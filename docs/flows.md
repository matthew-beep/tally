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
  Clicking is consent, so joining is immediate (`status: 'active'`).
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

**Status: designed, not yet built.** See `docs/group-member-model.md` for the
schema (`group_members.seat_token`). This section documents the intended
end-to-end flow so implementation has a spec to build against.

A guest (`group_members` row with `user_id = NULL`) can become a real member
of that specific group without losing the expense history already attached
to their seat — `expense_splits`, `expenses.paid_by`, and `settlements`
already key off `group_members.id`, so claiming is a single `UPDATE`, not a
data migration.

- **Getting the link** — every `group_members` row carries a `seat_token`
  (DB column default, same mechanism as `groups.invite_token` — generated
  unconditionally on insert, not just for guests). Any active member of the
  group can tap "copy claim link" on a guest row in group settings; the
  existing `group_members: members only` RLS policy already exposes the full
  row, token included, to everyone in the group, so no new policy is needed.
  The link is shared out of band (text, in person, etc.) — Tally never emails
  or SMSes it.
- **One link, works for both cases** — whoever opens `/claim/[token]` either
  already has a Tally account or doesn't; the flow doesn't need to know which
  in advance. Google OAuth and the existing `handle_new_user` trigger +
  onboarding-redirect middleware already branch new-vs-returning transparently.
- **The route**:
  1. `GET /api/claim/:token` (service role, works unauthenticated) validates
     the token and returns group/guest names, so a dead link can be rejected
     before sending anyone through OAuth. States: `invalid`, `already_claimed`,
     `valid`.
  2. If valid and there's no session → redirect to `/login?redirect=/claim/:token`,
     mirroring `/invite/[token]`'s existing immediate-redirect behavior. New
     accounts land in onboarding first (handle-null middleware redirect,
     unchanged), then land back on `/claim/:token`.
  3. If valid and authenticated → confirm screen → `POST /api/claim/:token`:
     `UPDATE group_members SET user_id = :profileId, name = :displayName
     WHERE seat_token = :token AND user_id IS NULL`.
- **Security boundary is the `WHERE user_id IS NULL` clause, not token
  secrecy after use.** The token is intentionally never nulled out on claim —
  a row with `user_id` already set can't be claimed again regardless of who
  holds the token, so keeping it lets a reused link report "already claimed
  by X" instead of a generic error.
- **Edge cases**: reused/already-claimed link → `already_claimed` state;
  claimer already has an active *or* `left` row in that same group → blocked
  by the existing `UNIQUE (group_id, user_id)` constraint, surfaced as a
  friendly "you're already connected to this group" error rather than a raw
  DB error; invalid/unknown token → `invalid` state.
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
  (`src/app/(dashboard)/me/page.tsx`) and home's `NeedsAttentionRail`.

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
