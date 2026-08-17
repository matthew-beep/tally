# Audit fix plan (2026-08-15)

_Written 2026-08-15 from a pass over `src/` and `supabase/migrations/`. This is a
**plan**, not as-built. Where this disagrees with the live Next app, the app
wins until the work lands._

Durable copy of the 2026-08-15 codebase pass. Implement in the order below —
later phases assume earlier RLS/write-path changes. Balance math, split
rounding, and `deleted_at` filtering are in good shape and are out of scope.

**Re-audited 2026-08-16.** Phases 1, 2, 4, and 5 were checked line-by-line
against the live migrations and source and are still accurate and open as
written. Three corrections came out of that pass:

- **Phase 3 is stale — already fixed before this plan was written.** See the
  note at the top of Phase 3 below.
- **Phase 6's "unused `EmojiTile`" claim is wrong** — corrected inline.
- **Phase 6's public share page item undersold the bug** — it's not a
  hardening task, the page is very likely fully broken today. Corrected
  inline.

This is **not** a re-audit of the 2026-07-19 RLS dashboard check in
[review-todo.md](./review-todo.md). That pass added the missing UPDATE/DELETE
policies, status-filtered `get_my_group_ids()`, and self-only `group_members`
INSERT. Those shipped. What is still open: self-join is not invite-gated,
profiles are still world-readable including email, settlement INSERT does not
pin parties/status, and several write paths are still non-atomic or ignore
0-row PostgREST updates.

---

## Phase 1 — RLS (exploitable with the anon/authenticated key)

New migration only — do not edit
`supabase/migrations/20260721000000_baseline_schema.sql`. Update the RLS
section of [schema.md](./schema.md) and the open findings in
[review-todo.md](./review-todo.md) when the migration lands.

### 1a. Stop joining any group by UUID

Today:

```sql
CREATE POLICY "group_members: self join" ON "public"."group_members"
  FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
```

- Drop the client INSERT policy (or restrict it so it cannot insert
  `status = 'active'` into an arbitrary `group_id`).
- All joins go through a service-role route that proves an invite token or a
  pending row (same pattern as `src/app/api/invite/decline/route.ts` and
  `src/app/api/groups/members/add/route.ts`).
- Tighten UPDATE: bind `group_id` (cannot change), allow only
  `pending → active` and `active → left`. A removed member must not flip
  themselves back to `active` or teleport `group_id`.

### 1b. Stop dumping emails / add_codes / claim_tokens

Today: `"profiles: anyone can read active"` has no `auth.uid()` check;
`GRANT ALL` to `anon`; member and notification queries use `profiles(*)`.

- SELECT policy requires a session (`auth.uid() IS NOT NULL`) and
  `status = 'active'` (keep own-row SELECT for the current user regardless of
  status).
- Revoke `email` and `claim_token` from `anon`/`authenticated` column grants.
  Own email comes from `supabase.auth.getUser()` in `src/queries/useProfile.ts`,
  not from `select('*')`.
- Replace every `profiles(*)` embed with the existing `ProfileSnippet` columns
  (`id, name, display_name, avatar_url, add_code, handle`) in
  `src/queries/useGroups.ts`, `src/queries/useProfile.ts` (`useNotifications`),
  `src/queries/useExpenses.ts`, `src/queries/useSettlements.ts`.

### 1c. Pin group create and settlement insert

- `groups` INSERT: `WITH CHECK (created_by = auth.uid())`. Rate limit on
  `/api/groups/create` stays as UX; RLS is the real cap.
- `expenses` UPDATE: `WITH CHECK` so `group_id` cannot be re-parented into
  another of the caller’s groups.
- `settlements` INSERT: caller must be `from_member_id` or `to_member_id`
  (via their seat), and client inserts cannot set `status = 'confirmed'`
  except the guest-payee case in phase 3 (or always insert `pending` and let
  a SECURITY DEFINER function set status).

---

## Phase 2 — Invite join, left-member rejoin, open redirect

### Invite link

`src/app/invite/[token]/page.tsx` cold-inserts without `name`
(`group_members.name` is `NOT NULL`). Move accept onto a new route, e.g.
`POST /api/groups/members/join` `{ token }`:

- Resolve group via `get_group_by_invite_token` (already SECURITY DEFINER).
- Load the caller’s display name from their profile.
- If no row: INSERT `{ group_id, user_id, name, status: 'active' }`.
- If `pending`: UPDATE to `active` and require `count > 0` (same 0-row check
  as `src/queries/useMembers.ts` `useAcceptGroupInvite`).
- If `left`: UPDATE back to `active` (invite-link is consent).
- If `active`: no-op, return the group id.

Check `data` / row count on every UPDATE; never `router.push` on a silent
0-row success.

### Search / QR re-add

`src/app/api/groups/members/add/route.ts` `ignoreDuplicates: true` is a silent
no-op for `left`. Change the upsert so `left → pending` (do not demote
`active` or refresh an existing `pending`). Count rate limit against rows
actually inserted, not once per request.

### Open redirect

`src/app/auth/callback/route.ts`, `src/queries/useAuth.ts`,
`src/app/onboarding/page.tsx`, `src/app/login/LoginButton.tsx`:

- Shared helper: only same-origin relative paths (`/` but not `//`, no
  `http:`, no `\\`). Fallback `/`.
- Callback must not redirect to `next` when `code` is missing or
  `exchangeCodeForSession` fails.
- `src/proxy.ts` login redirect should preserve `pathname + search` (today
  `?add=1` is dropped).

---

## Phase 3 — Settlement batch confirm/deny + guests

**Superseded — do not implement. Already fixed, 2026-08-16 re-audit.** This
phase describes a bug that was real but was independently fixed by the
`batch_id`/`batchStatus` model in `TODO.md` item 5, migrated in
`20260808000000_settlement_batch_id.sql` — **Aug 8, a week before this plan
was written on Aug 15.** Whoever wrote this plan missed that prior work.

Current state (verified against `src/lib/settlements.ts`,
`src/queries/useSettlements.ts`, `src/lib/notifications.ts`,
`src/components/notifications/SettlementReview.tsx`): every row in a batch
shares one `batch_id` and one status, computed from the **net across the
whole batch** (`batchStatus`/`batchNet`), not per row — so a mixed-direction
settle-all no longer asks a payee to vouch for a gross figure nobody actually
transferred. Confirm/deny already act on the full batch
(`batchSettlementIds`/`batchGroupIds`/`batchNotificationIds` in
`src/lib/notifications.ts`, both DB writes `.in('id', ...)` over the whole
set) — the "deny of one half leaves the offsetting row" failure mode this
phase warns about cannot occur, because there is no per-row status left to
diverge. Guest payees are handled too — `TODO.md` item 5 "Guests" note: a
guest exists in exactly one group, so a guest settle is always a batch of
one and stays on the ordinary per-row path.

Do **not** build the `confirm_settlement_batch`/`deny_settlement_batch`
SECURITY DEFINER RPCs proposed below — the client-side batch grouping already
does this atomically enough (each write is a single `.in('id', ids)`
statement) and adding server-side RPCs now would be redundant surface, not a
fix. If a real gap is ever found here, open it against `TODO.md` item 5's
"Phase 3 — close the gaps this flow opens" section, which is the live tracker
for this system, not this document.

Left below verbatim for the historical record of what the plan originally
proposed.

---

Mixed-direction settle-all (`src/components/home/BalanceSheet.tsx`
`handleSettleAll`) writes one `batch_id` with mixed `from`/`to`. The trigger
notifies **per row’s `to_member`**, so each person only sees a subset.
Confirm/deny in `src/queries/useSettlements.ts` then `.in('id', settlementIds)`
on that subset. Deny of one half leaves the offsetting row — that row was
never a real transfer.

Fix: SECURITY DEFINER `confirm_settlement_batch(batch_id)` /
`deny_settlement_batch(batch_id)` that:

- Verifies the caller is a party on the **net-payee** side of the whole batch.
- Updates or deletes **every** row with that `batch_id` in one statement.
- Client passes `batch_id`, not a list of ids.

Guest payees: `src/lib/settlements.ts` `batchStatus` must return `confirmed`
when the net payee seat has `user_id IS NULL` (spec: no confirmation flow
for guests). Needs the guest-ness of the counterparty on the allocation (or
a lookup inside the write function).

Also check confirm/deny row counts; a 0-row UPDATE must throw so the
notification card is not marked read while settlements stay `pending`.

---

## Phase 4 — Atomic expense writes

`src/queries/useExpenses.ts`: create inserts expense then splits; edit
updates amount → deletes splits → re-inserts. A failed second write leaves a
live expense with no splits (`calcNetBalances` no-ops; amount still shows).

- One `SECURITY DEFINER` function per path (`add_expense`,
  `update_expense_splits`) wrapping both writes in a single transaction.
- `expense_splits` INSERT should also require `group_member_id` belongs to
  the expense’s `group_id`.

---

## Phase 5 — UI correctness (loading, splits, dates, previews)

- `src/queries/useGroupDetail.ts`: wait on expenses/settlements; surface
  `isError` instead of “No expenses yet” / “Group not found”. Same for
  `src/app/(dashboard)/groups/page.tsx` (`useGlobalBalances().isLoading`),
  `src/app/(dashboard)/activity/page.tsx`, settings balances.
- Mobile exact/percent in `src/components/add-expense/useAddExpenseForm.ts`:
  seed `evenShares` **including** the payer (remainder on payer), matching
  desktop. Keep the implicit payer field on mobile if wanted, but validation
  must not require non-payers to sum to 100% of the bill.
- Date defaults: local `YYYY-MM-DD`, not `toISOString()` (UTC). Add
  `DatePicker` to `src/components/add-expense/MobilePanel.tsx`.
- Gate rename on `isAdmin` in
  `src/app/(dashboard)/groups/[id]/settings/page.tsx`; `onError` toast on
  `useUpdateGroup`.
- `src/app/(dashboard)/groups/new/page.tsx`: do not `router.push` until
  member-add errors are shown (or show them on the group page).
- Sidebar groups column: `overflowY: 'auto'`, not `hidden`
  (`src/components/dashboard/Sidebar.tsx`).
- Delete `src/app/devpreviewxyz/page.tsx` and `src/app/__preview/page.tsx`;
  remove `/devpreviewxyz` from `src/proxy.ts`.
- Remove `console.log('groups', groups)` in the groups list.

Left-member balances: include `'left'` in the people-list path (or a
dedicated former-member row) so pairwise amounts still visible in the hero
also appear in the list — CLAUDE.md invariant.

---

## Phase 6 — Remaining medium / quality

- **Public share page is likely fully broken, not just over-fetching —
  corrected 2026-08-16.** `expenses.paid_by` FKs to `group_members.id`
  (`expenses_paid_by_member_id_fkey`, not `profiles`), and `expense_splits`
  has no `profiles` relationship at all — only `group_member_id`. The current
  query (`payer:profiles!paid_by(*)`, `profile:profiles(*)` nested under
  `expense_splits`) has no FK path for PostgREST to embed either one, so it
  almost certainly errors and `{ data: expense }` comes back `null` —
  rendering "This link is invalid or has expired." for **every** share link,
  not just leaking extra columns on a working page. Confirm live, then fix
  the joins to go through `group_members` (and `group_members`' own
  `profiles` relationship) — narrowing columns (never `profiles(*)`, service
  role bypasses RLS) and filtering `deleted_at IS NULL` still both apply once
  the join actually resolves.
- Rate limit `/api/groups/members/claim-invite`; count `/add` and `/create`
  against member rows, not one check per request.
- Guard `NEXT_PUBLIC_DEV_EMAIL` so the password never ships in a production
  bundle (`NODE_ENV === 'development'` only).
- A11y: group rows / `FeedCard` as `Link` or `button`; `aria-label` on
  icon-only controls; restore `:focus-visible` for `.wntap`.
- `/groups/new` should use the dashboard 1024px shell breakpoint, not 767px.
- Dead code: unused `CONTENT_MAX_WIDTH` import in `groups/page.tsx` (it's
  genuinely used elsewhere, e.g. `activity/page.tsx` — just drop the stale
  import there), `.add-expense-mobile-*` CSS, unused `TabBar.tsx` (confirmed
  — not imported anywhere; the tab bar actually mounted is `DockedTabBar.tsx`,
  a different component; safe to delete).
  **Correction 2026-08-16 — `EmojiTile` is not dead code, do not delete it.**
  It's actively imported and rendered in `groups/[id]/page.tsx`,
  `components/feed/FeedCard.tsx`, `components/AddExpenseGroupPicker.tsx`, and
  `components/ExpenseActionSheet.tsx`. The original claim was wrong; deleting
  it would break the build.

---

## Out of scope

- Itemized splits, public share **product** (generating `share_token`),
  cross-group “settle all” UX redesign, sidebar balance dots, 3-col home
  dashboard, React Native port.
- Rewriting `calcNetBalances` / `make*Splits` — tests already match the
  seat model.
