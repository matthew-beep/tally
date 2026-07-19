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
  branches on financial history (checked via service role):
  - **No splits/expenses/settlements** → DELETE the pending row; the DELETE
    trigger notifies the inviter.
  - **Already in financial records** → the seat converts to a guest:
    `UPDATE group_members SET user_id = NULL, status = 'active'`. Splits
    keep pointing at the same `group_members` row, so history and balances
    survive. The UPDATE trigger (`20260711000000_decline_to_guest.sql`)
    sends `group_invite_declined` — and is guarded so the conversion never
    fires a false `group_invite_accepted`.

  Never DELETE a member row directly on decline — `expense_splits` cascade
  on member delete, which would silently corrupt balances.

**Pending members can be included in expenses.** `useGroupMembers` returns
`pending` + `active` on purpose — you can log a dinner split with someone
before they tap Accept. Pending gates their consent/visibility, not the math.
Because of that, pending members are visibly marked on group detail
(2026-07-19): "⏳ invited" pill in the members column, dimmed avatars in the
mobile strip, ⏳ in the empty-state preview.

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

## Edit / delete an expense

Tapping an expense row on the group page opens `ExpenseActionSheet`
(`src/components/ExpenseActionSheet.tsx`) — a three-screen bottom-sheet flow:

- **Actions** — expense summary + per-person split chips, Edit / Delete.
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
2. `simplifyDebts(net)` — greedy min-transfer list, used for "who pays who"
   suggestions.
3. Pairwise: `calcPairwiseNets(mySeatId, expenses, settlements)` — one
   member's per-counterparty map (positive = they owe me), the shape behind
   every "owes you / you owe" row; `summarizeBalances` folds it into
   `{ owedToMe, iOwe, net }` for hero numbers.
4. Cross-group: `useGlobalBalances` runs the per-group pairwise in seat
   space, translates seats → profile ids, merges across groups, and takes
   hero grosses from `summarizeBalances` — so the home hero always equals
   the sum of the person rows. Pure derivation over the per-group caches
   (see data-loading-architecture.md).

Settle up (`/groups/[id]/settle`):

1. Suggested transfer pre-filled from `simplifyDebts`; user adjusts payee /
   amount / date / note.
2. `useCreateSettlement` inserts with `status: 'pending'` — counts toward
   balances immediately; the DB trigger sends `settlement_confirm` to the
   payee (real users only; guests have no one to ask).
3. Payee confirms (`useConfirmSettlement` → status `confirmed`, trigger
   notifies payer) or denies (`useDenySettlement` → row DELETEd, balance
   reverts, trigger notifies payer).

Partial settlements need no special handling — they're just amounts stacked
against the running balance.

## Notifications & activity

Two separate systems:

- **Notifications** (stored; action-required): written *only* by DB triggers.
  Read via `useNotifications` (unread only). Invite accept/decline and
  settlement confirm/deny actions live on the Me page
  (`src/app/(dashboard)/me/page.tsx`).
- **Activity** (derived; history): `mergeFeed` (`src/lib/feed.ts`) merges
  expenses + settlements into one `created_at`-sorted timeline; the group
  page buckets it by month, `useAllActivity` by group. No events table, no
  activity queries of their own — both derive from the per-group caches.
