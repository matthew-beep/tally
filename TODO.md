# TODO

Completed phases (Supabase setup, auth, member-status model, notifications,
handle/identity system, settle-up rework, status-filter audit) have been
pruned — see `docs/` for how the shipped systems work and git history for the
old checklists.

**Legend:** 🟢 = mechanical / well-specified — Claude can run it solo.
🟡 = needs Matthew's oversight — a product/UX decision, prod credentials, or
a design reference.

---

## Pre-ship punch list (2026-07-26 planning session)

Matthew's list of what's left before shipping, in his priority order. Supersedes/pulls forward the overlapping items below (settle-up UX, desktop responsiveness, expense reactions) — this section is the source of truth for sequencing; the sections below still hold the implementation detail.

1. **Settlement flow — UX pass** 🟡 — not a functionality gap (create/confirm/deny all
   work end-to-end), it's that the flow itself feels bad. Diagnosed: `/groups/[id]/settle`
   is a full-page route with its own hand-rolled mobile chrome (safe-area spacer,
   back-button header, 480px-centered column) — inconsistent with how every other
   money-entry flow in the app now works.
   - **Direction agreed:** convert it to a modal/drawer sheet using `ModalOrSheet`
     (`src/components/modal`) — the same primitive `AddExpenseSheet`, `BalanceSheet`,
     and `PersonProfileSheet` already use (Vaul bottom sheet on mobile, centered modal
     on desktop, drag-to-dismiss). Model directly on `AddExpenseSheet` in
     `AddExpenseForm.tsx` (form component takes `onSuccess`/`onCancel` instead of doing
     `router.push`; a thin wrapper component renders `ModalOrSheet` around it).
   - Two same-page trigger sites move from `router.push('/groups/${groupId}/settle')`
     to local sheet-open state, same pattern as `addExpenseOpen`:
     `src/app/(dashboard)/groups/[id]/page.tsx` — desktop header-band CTA (~line 218)
     and the per-member "Settle up" row button (~line 472).
   - The `/groups/[id]/settle` route itself should stay addressable (Home's
     `BalanceSheet` cross-group CTA navigates to it — `src/components/home/BalanceSheet.tsx`
     ~line 154 — since the target group may differ from the page you're on) but its
     page component becomes a thin wrapper rendering the same sheet pre-opened,
     closing back to the group page instead of a custom full-page layout.
   - This also incidentally fixes desktop presentation for settle-up (item 4 below) for
     free, since `ModalOrSheet` already branches mobile/desktop.
   - **Decided 2026-08-02 — pairwise wins, `/settle` deleted.** The two entry points
     used different debt models (`SettleUpSheet` on `calcPairwiseNets`, `/settle` on
     `simplifyDebts(calcNetBalances(...))` — greedy min-transfer, could name a
     counterparty you'd never split with). Turned out moot: by the time this was
     decided, nothing in the app linked to `/settle` anymore — the group-page
     triggers and home's cross-group CTA had already been migrated to `SettleUpSheet`
     in the same day's earlier commits. So this wasn't "collapse route into sheet,"
     it was "delete now-orphaned code": `src/app/(dashboard)/groups/[id]/settle/`
     deleted outright (no redirect — nothing points at the URL), `simplifyDebts` +
     its 5 tests deleted from `lib/balance.ts`/`balance.test.ts` (only caller was the
     deleted route), `DebtTransfer` type deleted (only used by `simplifyDebts`).
     `CLAUDE.md`, `docs/flows.md`, `docs/features.md`, `docs/review-checklist.md`
     updated to stop describing the min-transfer model / the dead route. Typecheck
     + full test suite clean (45/45, down from 50 — the 5 deleted tests).
   - **Visual/interaction reference found** (2026-07-26): claude.ai/design project
     "splitter" (`36d6382c-156c-422e-afd2-063025ff0a0f`), file `Settle Up Flow.html`
     (imports `variation-settle-flow.jsx` + `settlement-confirm.jsx` +
     `tally-shared.jsx`). Only the drawer pieces apply — the group-page redesign and
     the full-screen success states (`SFPaymentSent`/`SFSettlementConfirmed`) are out
     of scope for this item. Two drawers worth matching:
     - `SFSettleSheet` — list split into "Owed to you" (Remind) / "You owe" (Pay),
       not a single select-a-transfer radio list like the current page.
     - `SFRecordPayment` — payment-method chips (Venmo/Zelle/Cash/PayPal/Other) + note,
       opened on top of the settle list.
     Implementation note: the mockup renders these as two independently-stacked
     absolute overlays, which is a static-HTML trick, not something to reproduce with
     two nested Vaul `Drawer.Root`s. Match `ExpenseActionSheet.tsx`'s pattern instead —
     one sheet, internal `screen` state (`'list' | 'record-payment'`) swapping content.
   - **Decisions made against the reference:**
     - **Payment method → real column.** Add `settlements.method` via migration
       (not folded into `note` as text) — schema change, touches RLS/types same as any
       other column addition.
     - **Keep the amount editable**, unlike the mockup's fixed non-editable hero number
       — matching it exactly would regress the "partial settlements just work"
       invariant (see CLAUDE.md). Record-payment step pre-fills from the transfer amount
       but the field stays editable.
     - **No `settled_date` field in the UI** — keep defaulting it to today under the
       hood, same as the mockup implies (drop the date picker from the current page).
     - **"Remind" button — decided against, not deferred** (superseded
       2026-07-31, see approach note below): dropped entirely rather than
       stubbed. The debt showing up on the dashboard/group balance already
       does the reminding; owed-to-you rows get "Mark as paid" instead, no
       separate no-op action.
     - **`SFIncomingConfirm`-as-group-page-banner is a separate, smaller addition** —
       today confirm/deny only lives on `/me`. The mutations
       (`useConfirmSettlement`/`useDenySettlement`) already exist and are cheap to
       reuse for a group-detail banner + sheet, but treat it as its own task, not
       part of the settle-drawer rebuild.
   - **Approach note (2026-07-31)** — worked out while investigating why the
     group page and `useGlobalBalances` don't share one balance path (they
     can't: `settlements.from_member_id`/`to_member_id` FK to `group_members`,
     so anything writing a settlement needs seat-keyed data, while
     `useGlobalBalances` deliberately re-keys seats → profile ids at its merge
     step for cross-group folding). Net of that: `SettleUpSheet` should be a
     **dumb, props-driven component** — no `useGroupDetail`/`calcNetBalances`/
     `simplifyDebts` calls inside it at all. The caller (group page or
     dashboard) already has the numbers computed; hand them down instead of
     making the sheet re-fetch and re-derive:
     ```ts
     interface Transfer { groupMemberId: string; amount: number; direction: 'owed' | 'owe' }
     // <SettleUpSheet groupId mySeatId transfers={Transfer[]} preselect={Transfer | null} .../>
     ```
     - **Group page**: `page.tsx`'s existing `oweMeEntries`/`IOweEntries`
       (built from `calcPairwiseNets`, not `simplifyDebts` — this also fixes a
       latent mismatch where the old sheet's list screen used the group-wide
       minimum-transfer matching while the balance card showed direct pairwise
       nets, i.e. two different numbers for the same person) map straight onto
       `Transfer[]`; the per-member "Settle up" button already has `amount` and
       `memberId` in its closure and can hand over a fully-formed `Transfer` as
       `preselect`, no lookup needed.
     - **Dashboard**: `PersonEntry.parts` (`(dashboard)/page.tsx`'s
       `buildPeopleFlow`) is already `Transfer`-shaped per group, just missing
       a `groupMemberId` (it's profile-keyed, from `useGlobalBalances`). One
       small shared helper resolves seat ids on demand:
       `resolveSeatId(gb, groupId, personId) = gb.membersPerGroup[groupId].find(m => m.user_id === personId || m.id === personId)?.id`
       — used both for the counterparty and for "my seat in that group."
       `BalanceSheet.tsx`'s existing settle CTA already picks
       `visibleParts[0]` (largest balance) before navigating to
       `/groups/:id/settle`; same default, just resolve seats and open
       `SettleUpSheet` in place instead of routing away. A person with
       balances in >1 group only ever needs the single largest-balance
       `Transfer` for a plain row tap — a real "settle all groups at once"
       multi-insert flow is Pre-ship #5 (dashboard path) / Later if #5 ships
       single-group only, not implied by this.
     - Net effect: one shared sheet/screens, zero branching inside the sheet
       on which surface opened it — the fork is entirely in how each caller
       builds its `Transfer`(s) before rendering the sheet.
   - **Follow-up decisions (2026-07-31)** — both extend the same
     `Transfer.direction` field, no new prop needed:
     - **Owed-to-you rows become actionable: "Mark as paid."** Today's list
       screen only had a no-op "Remind" for that direction (see above — now
       dropped, not just stubbed). Tapping it opens the same record-payment
       screen as "Pay," tagged `direction: 'owed'`.
     - **Creditor-initiated settlements skip the pending/confirm step
       entirely** — if I'm marking that someone else already paid me, I'm
       not asking myself to confirm my own claim. Two things need to change
       for this, both currently hardcoded for the debtor-initiated case only:
       - `useCreateSettlement` (`useSettlements.ts`) inserts
         `status: 'pending'` unconditionally — needs to insert `'confirmed'`
         directly when `direction === 'owed'`. Schema already allows it
         (`CHECK (status IN ('pending','confirmed'))`), no migration needed
         for this part.
       - `notify_settlement_created` (the `AFTER INSERT` trigger) currently
         fires `settlement_confirm` to `to_user` unconditionally — for a
         confirmed-on-insert row `to_user` is the inserting user themselves,
         which is wrong (asks you to confirm your own action). Needs to
         branch on `NEW.status`: `pending` → existing `settlement_confirm`
         to `to_user`; `confirmed` → `settlement_confirmed` to `from_user`
         instead (an FYI: "X marked you as settled," informational, not
         action-required). Small migration, same shape as the existing
         trigger.
     - **No dispute mechanism for a wrongly-marked "they paid me" claim** —
       consistent with the existing "denial = DELETE, no disputed state"
       invariant, just extended to a claim the other party made. The
       mitigation is being able to delete a settlement after the fact (next
       item), not a formal dispute flow.
   - **New: delete a settlement** (2026-07-31) — nothing exists for this
     today beyond `useDenySettlement`, which only ever targets `pending` rows
     from the `/me` deny flow. Needed pieces:
     - `useDeleteSettlement` mutation — same DB operation, new call site for
       arbitrary (including confirmed) rows.
     - A UI entry point — settlement rows in the group feed
       (`groups/[id]/page.tsx`'s feed rendering) aren't tappable at all today,
       unlike the expense rows right above them (`onClick={() =>
       setExpenseSheet(e)}`). Needs its own small action sheet, not just
       reusing `ExpenseActionSheet`.
     - **Permission — decided:** only the two people party to the settlement
       (`from_member_id` or `to_member_id` matching the caller's own seat)
       can delete it — not any active group member. `docs/review-todo.md`'s
       RLS audit only flagged `settlements` UPDATE as needing payee-only
       tightening; DELETE was never restricted, so it's likely still open to
       any group member via the general group-scoped policy today. Deleting
       (not just denying-while-pending) needs its own migration to add that
       restriction — don't assume the existing policy already covers this.

2. **Emoji reactions on expenses** 🟡 (schema + UX) — react to an expense with an emoji,
   this is a new concept, not an extension of the existing group-emoji or category-emoji
   pickers.
   - **Schema direction agreed:** a new table, not a column on `expenses` — same shape as
     `expense_history`/`notifications` (append-only rows joined in). Proposed:
     ```sql
     expense_reactions (
       id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       expense_id      uuid REFERENCES expenses ON DELETE CASCADE NOT NULL,
       group_member_id uuid REFERENCES group_members ON DELETE CASCADE NOT NULL,
       emoji           text NOT NULL,
       created_at      timestamptz DEFAULT now(),
       UNIQUE (expense_id, group_member_id, emoji)
     )
     ```
   - **Reaction shape agreed:** Slack-style — one person can add several distinct emoji
     reactions to the same expense; tapping an emoji they've already used removes it
     (not a single replaceable reaction slot). The `UNIQUE(expense_id, member, emoji)`
     constraint is what makes this cheap.
   - **RLS pattern** — mirror what's already in the baseline migration
     (`supabase/migrations/20260721000000_baseline_schema.sql`):
     - SELECT: `expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT get_my_group_ids()))`
       (same join-through-expenses shape as `expense_splits`/`expense_items`).
     - INSERT/DELETE: scoped to your own row, same shape as the `settlements: payee can
       update` policy — `group_member_id IN (SELECT id FROM group_members WHERE user_id
       = auth.uid())`, ANDed with the SELECT's group-membership check on INSERT.
   - **Data loading** — add `reactions:expense_reactions(id, emoji, group_member_id)` to
     the nested select in `expensesQueryOptions` (`src/queries/useExpenses.ts`), same
     pattern already used there for `splits` and `payer`. Reactions ride along with the
     expense feed for free; toggling one just invalidates `['expenses', groupId]`.
   - **UI** — home is `ExpenseActionSheet.tsx` (the expense detail sheet): grouped pills
     (emoji + count), highlight ones you've reacted to, tap to toggle. "Add reaction"
     button opens a picker adapted from the existing `EmojiPickerSheet.tsx` component —
     it's single-select with a highlighted "current" emoji today; reactions need the
     highlight/current concept dropped (multiple picks, no "current").

3. **Spending leaderboard** 🟡 (needs a design pass — nothing scoped yet beyond this) —
   **per-group**, ranks members by total paid. Lives on the group detail page. Was
   previously filed under "Later (Phase 2+/3)" as a vague "group leaderboards" bullet —
   promoted here now that scope (per-group, ranked by amount paid) is confirmed. Open
   questions for next time: exact placement on the page, whether it's all-time or
   filterable by date range, tie-breaking.

4. **Responsive views for every screen** 🟡 — no new decisions made this session; this is
   the existing "Desktop / web layout — remaining" backlog further down this file
   (home 3-column layout, modal sizing audit, group settings desktop treatment, the
   §19e Vaul conversion for `ExpenseActionSheet`). Settle-up's desktop gap gets fixed
   as a side effect of item 1 above.

5. **Finish cross-group settlement flow from dashboard** 🟡 — **UI shipped
   2026-08-02, data layer still open.** `BalanceSheet.tsx` no longer routes
   away to a group page at all (the `/groups/[id]/settle` route it used to
   target is deleted, see item 1). It now has its own two screens, both
   still no-op on the write:
   - **Balance screen's "Settle up with X" CTA** → a settle-all confirm
     screen: full net total, every group at its full balance, single
     "Confirm settlement" button.
   - **Tapping a specific group row** → a new `GroupSettleScreen`, drilled
     into in place (no navigation): that one group's balance as a big
     editable number, Full/Half/Clear quick-set chips, its own "Settle $X
     in [Group]" button. Settling here never touches the person's other
     groups.
   Both buttons are `onClick={() => {}}` today. Reference design:
   `Dashboard Settle.html` in the `splitter` claude.ai/design project
   (`36d6382c-156c-422e-afd2-063025ff0a0f`).

   **Data layer — not started, design worked out 2026-08-02:**
   - **Seat resolution.** `PersonPart` (built in `buildPeopleFlow`,
     `(dashboard)/page.tsx`) is profile-keyed and has no
     `group_members.id` — but `settlements.from_member_id`/`to_member_id`
     FK to `group_members`. Add a `resolveSeatId(gb, groupId, personId)`
     helper (`gb.membersPerGroup[groupId].find(m => m.user_id === personId
     || m.id === personId)?.id`) and extend `PersonPart` with
     `groupMemberId` (counterparty seat) + `mySeatId`, resolved once in
     `buildPeopleFlow` so `BalanceSheet` stays dumb/props-driven.
   - **One batch mutation for both buttons** — `useCreateSettlements()`
     (plural, new, alongside `useCreateSettlement` in `useSettlements.ts`)
     takes an array of settlement rows and does a single
     `.insert([...])` call. A multi-row Supabase insert compiles to one
     atomic SQL `INSERT`, so this covers both the single-row drill-down
     case and the N-row settle-all case without a transaction-wrapping
     RPC. `onSuccess` invalidates `['settlements', groupId]` for every
     distinct `group_id` in the batch.
   - **Status isn't uniform per row.** Same rule as item 1's follow-up
     decision (creditor-initiated settlements skip pending): a row where
     *they* owe *me* inserts `status: 'confirmed'` directly (I'm the one
     saying "they paid me"); a row where *I* owe *them* inserts `'pending'`
     (awaiting their confirmation). Settle-all can produce a mix of both
     in one batch depending on each group's direction.
   - **Blocks on the same trigger fix item 1 already flagged and never
     shipped**: `notify_settlement_created` fires `settlement_confirm` to
     `to_user` unconditionally, which is wrong for a `confirmed`-on-insert
     row (`to_user` would be yourself). Needs the `NEW.status` branch
     described under item 1 before either "mark as paid" or this feature's
     confirmed-rows can ship without spamming a self-confirmation.
   - Wire both `BalanceSheet.tsx` CTAs to build their row array (1 row for
     the drill-down, N for settle-all) and call `useCreateSettlements`.

6. **Activity page — flat recent feed, not keyed by group** 🟡 — **done**
   `/activity` is a single chronological feed (`useAllActivity()`); home rail
   uses `useAllActivity(6)`. Group shows as row metadata via `showGroup`.
   Removed `ActivityGroup` bucketing.

7. **Code review** — run `/code-review` (or `/code-review ultra` for the deeper
   multi-agent pass) once 1–6 are done, before calling it shippable.

---

## Now — in priority order

Thread: correctness → abuse protection → small visible wins → big flows.
Steps 1–4 ≈ two solid sessions and the app is safe to hand to real users.

### 1. Ship the decline fix — done

- [x] **Applied `20260711000000_decline_to_guest.sql` to the cloud project**
  (2026-07-11). Full decline flow live: no-history declines delete the row,
  declines-with-history convert the seat to a guest, inviter gets the correct
  `group_invite_declined` notification either way.

### 2. Bug sweep 🟢 — done

- [x] **Invisible notifications** — `group_invite_accepted`/`declined` added
  to the `Notification` union; Me page now whitelists info types
  (`INFO_TYPES`), renders per-type labels, and auto-marks them read on view
  (`useMarkNotificationsRead`, no invalidation so rows don't vanish
  mid-read). Also fixed en passant: the old `type !== 'settlement_confirm'`
  filter rendered pending `group_invite` rows a second time as
  "✗ Payment denied · $0.00".
- [x] **`ExpenseActionSheet` split header** — now branches on `split_type`
  (equally · $X each / exact amounts / percentage / items).
- [x] **Deleted `src/lib/mockData.ts`**.
- [x] **Silent add-member failure** — `handleAddMembers`
  (`groups/[id]/page.tsx`) had a `try { } finally { }` with no `catch`; any
  failure (network, validation, or the new 429 from rate limiting) became
  an unhandled rejection with zero user feedback. Added `addError` state,
  surfaced in both the desktop and mobile add-member panels, parsed from
  the route's `{ error }` body when present.
- [x] **Dead code removed** (2026-07-13) — `AddMemberModal`,
  `NewGroupModal`, `BalanceBreakdownModal`, `AmountDisplay`, `AppShell`,
  `useAddGroupMember`, and a `DROP FUNCTION` migration for the stale
  `create_group_with_members` RPC (needs `db push`). Details under
  Consolidation.

### 3. Rate limiting 🟢 (implementation) / 🟡 (sign off on the numbers)

**Approach (decided): count recent rows in existing tables — no new vendor,
no new table.** The DB already records who did what when (`groups.created_by`
+ `created_at`, `group_members.invited_by` + `joined_at`). A small helper
queries the count in the window with the service-role client and the route
returns 429 over the limit. Racy at the margin (two concurrent requests can
both pass) — acceptable slop for rate limiting. Serverless-safe because state
lives in Postgres, not instance memory. Limits are set ~10x above honest
usage: they cap worst-case damage, not shape behavior. Log 429s, tune later.

- [x] `src/lib/rateLimit.ts` — written, **not yet wired into any route**.
  One function: `isOverLimit(admin, source, identifier, limit, windowMs)`.
  `source` (`{ table, userCol, timeCol }`) is a plain parameter, not a
  per-action wrapper — no `groupCreateLimiter`/`memberInviteLimiter`
  ceremony. Counts existing domain rows, fail-open, logs `[rate-limit]`
  lines. Swapping the source of truth (Postgres → Redis/Upstash later)
  means a differently-shaped `isOverLimit` with the same
  `(identifier, limit, windowMs)` call convention — callers switch which
  function they import, nothing else changes.
- [x] **Wired `/api/groups/create`** — 10/hr via `created_by`/`created_at`;
  429 + `Retry-After: 3600` when hit.
- [x] **Wired `/api/groups/members/add`** — 30/hr via `invited_by`/
  `joined_at`. Guest inserts originally had `invited_by NULL` and bypassed
  the limiter entirely; fixed 2026-07-19 (`605bf24`) to set `invited_by` on
  guest rows too, so the limit covers the whole insert surface. 429 +
  `Retry-After: 3600` when hit.
- [ ] **`/api/invite/decline`** — no limiter needed: requires an existing
  pending membership, so it's self-limiting.
- [x] **Search debounce** — new shared `useDebouncedValue` hook
  (`src/hooks/useDebouncedValue.ts`); `AddMemberModal` now debounces at
  250ms before hitting `useSearchProfiles` (was firing on every keystroke).
  `MemberCombobox` already had its own inline 250ms debounce — deduped onto
  the shared hook. `useSearchProfiles` also got `placeholderData:
  keepPreviousData` so results don't flash empty between ticks. The
  `useMemberSearch` extraction (Backlog → Hooks) is still open — this just
  fixed the debounce gap, didn't do the full hook extraction.
- [ ] **Supabase auth limits** 🟡 — dashboard review only (built-in), no
  code. Tally is Google-OAuth-only, so the email-based limits (magic
  link/password reset) don't apply — the one worth checking is the
  sign-in/session rate cap, in case a burst of invite-driven signups (e.g.
  everyone in a group joining around the same time) would hit it.

**Known limitation (accept for MVP):** expense/settlement writes go client →
PostgREST directly with the user's JWT, bypassing Next entirely — nothing at
the app edge can limit them, and profile search is likewise callable directly.
RLS bounds the blast radius to the user's own groups. Real enforcement means
moving writes behind API routes or DB-side counters — revisit only with
evidence of abuse. `/api/ocr` (Phase 3) must launch with a limiter (same
counting pattern against an OCR-requests log; ~20/day per user — it burns
real compute).

### 4. Small wins: bell badge + app-level prefetch 🟢

Badge **depends on step 2** — ship it first or the count is permanently wrong.

- [ ] **Unread count badge on nav bell** — single-int query,
  `refetchInterval: 30_000` while tab active (per CLAUDE.md sync rules)
- [ ] **App-level data prefetch** — `useGlobalBalances` only runs on the home
  page, so deep-linked pages lack cross-group balance data (avatar taps on
  the group detail balance card have nothing to show):
  - [ ] `src/components/GlobalDataPrefetch.tsx` — calls `useCurrentProfile`
    + `useGlobalBalances` once on app load
  - [ ] Mount inside `<Providers>` in `src/app/layout.tsx`
  - [ ] Wire avatar tap in group detail balance card expanded rows →
    `PersonProfileSheet` using cached global balances

### 5. Group settings + leave group — mostly done (shipped `group-settings` branch, PR #1, 2026-07)

Creator (`created_by`) is the admin.

- [x] **Route** — `src/app/(dashboard)/groups/[id]/settings/page.tsx`
- [x] **Rename group** — name + emoji picker (`EmojiPickerSheet`)
- [x] **Member management (remove)** — admin removes active members
  (`useRemoveMember` → `/api/groups/members/remove`, sets `status: 'left'`,
  server-side blocks removal while the member has an unsettled balance)
- [x] **Leave group** — non-admin: `status: 'left'` via `useLeaveGroup`,
  tap-to-confirm in the danger zone
- [x] **Delete group** — admin only, `DeleteGroupSheet` blocks while any
  member's balance is non-zero
- [x] **Group settings entry point** — 2026-07-26: `GroupActionMenu` (the
  ellipsis bottom-sheet with Group settings/Add member/Leave group/Delete
  group items) deleted. Both its trigger buttons on group detail now go
  straight to `/groups/[id]/settings` via a settings-gear icon — no menu
  step. Safe because every other item was already redundant or reachable
  elsewhere: "Leave group" just routed to settings anyway; "Add member"
  has its own independent triggers on the group detail page unrelated to
  the menu; "Delete group" is still fully available via the settings
  page's own danger zone (one extra tap instead of a group-detail
  shortcut). Also drops `GroupActionMenu` out of consolidation pass 2's
  #3 (`review-todo.md`) — only `DeleteGroupSheet` and `ExpenseActionSheet`
  still hand-roll their own sheet chrome now.
- [ ] **Invite link** — show + copy + regenerate `invite_token`. Not built
  anywhere: the token exists on `groups` and `/invite/:token` accepts it,
  but no UI surfaces it, so link-based invites are currently dead — the only
  way to add someone today is `MemberCombobox` search/QR/guest.
- [ ] **Cancel pending invite** — pending members render as a static
  read-only row in settings (no tap handler); need a DELETE path (safe only
  while the pending row has no splits — reuse the decline route's history
  check) and to wire it into `MemberActionSheet` or a dedicated action for
  pending rows.

### 6. Expense editing — remaining

- [ ] **Edit history drawer** 🟡 (light — needs a look at the sheet design) —
  tap "(edited)" → sheet listing `expense_history` snapshots (edited_by name,
  date, old amount/description). Needs a read hook.
- [ ] **Split editing** 🟡 — edit drawer keeps split membership read-only;
  editing who's in the split / split mode means re-running the full split
  builder (reuse `AddExpenseForm` machinery)

### 7. Itemized splits 🟡 (schema + UX design)

`equal`, `exact`, `percentage` shipped (running remainder counters included).

- [ ] `itemized` — line items assigned to members, tax/tip distributed
  proportionally. Requires `expense_items` + `expense_item_assignments` tables
  (not yet created). Mobile builder UI exists as a non-saving preview in
  `AddExpenseForm`. Phase 3 receipt scanning pre-fills this flow.

---

## Prod readiness (from 2026-07-11 codebase audit)

- [x] **Audit RLS coverage + capture a baseline migration** — done
  2026-07-19/21. RLS audit (`docs/review-todo.md`) found and fixed two
  critical gaps (`group_members` UPDATE, `expense_splits` DELETE) plus a
  followup tightening bundle (`605bf24`: `get_my_group_ids()` status
  filter, self-only `group_members` INSERT, dropped client DELETE,
  payee-only settlement confirm). Baseline migration squashed 2026-07-21
  (`482424b`) — one replayable schema dump, `db reset`/`db pull --linked`
  now match prod with zero drift.
- [x] **Switch API routes from `getSession()` to `getUser()`** — done
  2026-07-19, commit `605bf24`. All three routes call
  `supabase.auth.getUser()`.
- [x] **Global mutation error surface** — done 2026-08-02. `providers.tsx`'s
  `QueryClient` now takes a `MutationCache` with a global `onError` — pushes
  a toast (message from the thrown `Error`, or a generic fallback) regardless
  of whether the mutation has its own local `onError` too, so all 7 previously
  unguarded `mutateAsync` sites (`groups/new`, `me`, `useAddExpenseForm`,
  `DeleteGroupSheet`, `ExpenseActionSheet` ×2, `SettleUpSheet`) get feedback
  for free with zero per-site changes. Toast state lives in the existing
  `useUIStore` (Zustand) as a `toasts` queue + `pushToast`/`dismissToast`;
  `src/components/Toast.tsx` renders the stack (bottom-centered, dark card,
  coral accent dot, auto-dismiss 5s or tap), mounted once in `Providers`.
  Root `src/app/error.tsx` added for render-time errors (client component,
  `reset()` + a link home). Verified live: built a throwaway public test
  route, drove it with Playwright (fetched via npx — not a project
  dependency), confirmed the stack renders, stacks, and auto-dismisses with
  zero console errors, then deleted the scratch route. Typecheck + full
  build + 45/45 tests clean.
- [ ] **Generated Supabase types** 🟡 (needs linked-project login) —
  `types/index.ts` is handwritten and has already drifted (Notification
  union). `npx supabase gen types typescript --linked > src/types/supabase.ts`,
  then chip away at the 17 `as any` casts.
- [ ] **CI** 🟢 — no `.github/workflows`. Add typecheck + test + build on
  push/PR; the vitest suite exists now so this pays immediately.
- [ ] **`import 'server-only'` in `src/lib/supabase-server.ts`** 🟢 — build-time
  guard so the service-role module can never be pulled into a client bundle.

### Polish / small fixes

- [x] **Display name editing** — shipped: Me page edits `display_name` +
  `handle` with dirty-checking and save via `useUpdateProfile`.
- [ ] **Home page layout** 🟡 — desktop multi-column layout differs from the
  `DashboardPage` wrapper used elsewhere; consider aligning (see Desktop)
- [ ] **Balance cards expand button** 🟡 — modal with full per-person
  breakdown (who owes what, across which groups)

### Desktop / web layout — remaining

Sidebar/tab-bar responsive split is done (breakpoint 1024px, `dashboard.css`).
Group detail 2-column layout (§19) shipped.

- [ ] **Home dashboard 3-column layout** 🟡 — reference `home-overview.jsx` in
  the design project. Left 340px: compact balance hero + groups mini-list;
  middle flex: recent activity; right 285px: per-person "Up Next" owe/owed
  action cards. Single column below 1024px. All data already fetched —
  layout + rendering task only. (Full column-by-column spec lived in TODO
  §18 — see git history if needed.)
- [x] **Modal sizing audit** 🟢 — done 2026-07-26 as part of §19e below.
  `DeleteGroupSheet` and `ExpenseActionSheet` were the only stragglers not
  on `ModalOrSheet`; both migrated. Every sheet in the app now goes through
  the shared primitive.
- [x] **19e** 🟢 — done 2026-07-26: `ExpenseActionSheet` migrated from its
  hand-rolled `createPortal`/backdrop/slide-up to `ModalOrSheet` — Vaul
  bottom sheet with drag-to-dismiss on mobile, centered ~460px modal on
  desktop. Built from the "Desktop A — faithful port" direction explored
  in the `splitter` design project (`Expense Action Desktop.html` /
  `expense-action-desktop.jsx`): same three screens (actions/edit/delete)
  stacked the way they read on mobile, just wider and calmer, using the
  `EmojiTile`/`SectionLabel`/`formatAmount` atoms already built this
  session. Scoped down from the design reference: kept the existing plain
  `formatAmount()` text instead of adopting the design's fuller
  sign+$-at-half-opacity/big-number/mono-cents amount lockup — that's the
  deferred `<Money>` hero component (see `review-todo.md` #6), out of
  scope for a chrome migration. Typecheck + production build clean; not
  yet exercised live in a browser.
- [x] **19f** — wire group action menu items (done alongside "Now" step 5;
  settings still needs the desktop layout pass noted above)

### Consolidation / dead code (from 2026-07-13 duplication audit)

**Dead code — deleted 2026-07-13** (all recoverable from git history):
- [x] `AddMemberModal.tsx` (496) + `useAddGroupMember` — deleted. If the
  richer add-member UX (QR / invite-link / recents in one dialog) is wanted
  later, resurrect from git or rebuild on `MemberCombobox`.
- [x] `NewGroupModal.tsx` (132) — deleted; `groups/new/page.tsx` is the one
  create path.
- [x] `BalanceBreakdownModal.tsx` (111) — deleted. Note for the "balance
  cards expand" polish item: this was a per-person breakdown modal —
  resurrect from git if it fits rather than rebuilding.
- [x] `AppShell.tsx` (14) — deleted.
- [x] `AmountDisplay.tsx` (48) — deleted. If the style-guide money anatomy
  is ever enforced app-wide, rebuild it then and migrate the ~40 inline
  `toFixed(2)` call sites in one sweep.
- [x] `create_group_with_members` RPC —
  `20260713000000_drop_stale_group_rpc.sql` written; **needs
  `npx supabase db push`** to take effect in prod.

**Logic implemented more than once:**
- [ ] 🟢 **Balance math ×3** — `lib/balance.ts` (tested), `useGlobalBalances`
  (reimplements nets/pairwise/gross inline, 292 lines), and group detail
  `page.tsx` (inline pairwise nets). **Design settled — see "Shared balance
  core" in `docs/review-todo.md`** (calcPairwiseNets + summarizeBalances,
  seat-space core, identity fold in the hook). Decided worth doing
  2026-07-13; build on request.
- [ ] 🟢 **Avatar slot color ×8, two conventions** — `hashSlot(id)` defined
  identically in 5 files (home, SuggestedMembers, AddMemberModal,
  BalanceBreakdownModal, MemberCombobox), `slotFor(members, id)`
  (index-based) in 3 (group detail, settle, ExpenseActionSheet). The two
  conventions give the SAME person DIFFERENT colors on different screens
  (hash of id vs position in member list). Pick one (index-based matches
  the style guide's "deterministic by slot"), export it once (e.g. from
  `lib/memberDisplay.ts`), delete the other 7 copies.
- [ ] 🟢 **Display-name fallback** — `lib/memberDisplay.ts` exists but 10
  files still inline `display_name ?? name` (mostly on `ProfileSnippet`,
  which the helper doesn't accept). Add a profile-shaped overload and
  migrate call sites.
- [ ] 🟢 **Invalidation key lists** — the same 5-key invalidation block
  (`expenses`, `settlements`, `global-balances`, `recent-activity`,
  `all-activity`) is copy-pasted across `useExpenses`/`useSettlements`
  mutations. Extract an `invalidateMoneyData(qc, groupId)` helper so a new
  aggregate key can't be forgotten in one of five places.
- [ ] 🟢 **Mobile/desktop duplicate add-member JSX** in group detail —
  two hand-written copies of the same panel; extract one component.
- [ ] Modal system fragmentation — already tracked (Desktop → modal sizing
  audit + review checklist Phase 6).

### Hooks extraction 🟢

Extract business logic from fat components into `src/hooks/`. Components keep
JSX, event wiring, presentational state; hooks own queries, mutations, derived
values, form state.

**Conventions** (settled in an earlier review — the old architecture doc was
removed):
- Navigation via `onSuccess` callback — never `next/navigation` inside a hook
- Never write to `notifications` in a hook — DB triggers own all inserts
- `queries/` = raw fetch/mutate hooks; `hooks/` = composition with local state
- `category` is `useState` seeded from `detectCategory` (user can override),
  not a pure derived value
- Extract only where there's real form/interaction state or genuine reuse;
  otherwise call query hooks directly and `useMemo` derived values

**Worth extracting:**
- [ ] `useAddExpense` — the split-building + category logic in `AddExpenseForm`
- [ ] `useSettleUp` — pre-fill from debt simplification, validation
- [ ] `useCreateGroup` — name/emoji form state + mutation
- [ ] `useMemberSearch` — debounce, three input modes, query gating (folded
  into "Now" step 3)

**Skip:** `useGroupsList`, `useHome` — pure query composition with no second
consumer.
- [x] **`useGroupDetail`** — done 2026-07-31, contrary to the "skip" call
  above: turned out to have 3 identical-shape consumers already
  (`groups/[id]/page.tsx`, `settings/page.tsx`, `settle/page.tsx`), each
  duplicating the same `useGroup`+`useGroupMembers`+`useExpenses`+
  `useSettlements`+`useCurrentProfile` bundle verbatim. Thin composite in
  `src/queries/useGroupDetail.ts` — calls the existing per-resource hooks and
  returns them bundled, each keeping its own queryKey (not a merged query),
  so mutation invalidation and `useAllGroupData`'s fan-out are unaffected.
  `AddExpenseForm.tsx` intentionally left on individual hooks — its two call
  sites use different subsets and would otherwise fetch expenses/settlements
  they never read.

### Later (Phase 2+/3)

- Public expense share page (`/expense/[share_token]`) — skeleton exists,
  needs service-role fetch
- Guest claim flow (`claim_token`, email match, manual link)
- "Former member" display for left members
- Receipt scanning / OCR (`/api/ocr`) — Phase 3, feeds `itemized`
- Expense reactions, group leaderboards
- Email notifications, dark-mode toggle surface, PWA/offline
