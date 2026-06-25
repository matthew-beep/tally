# TODO

## 0. Immediate — group members + expense refinement

### 0a. Add members to existing group (BROKEN — blocks usage)
- [ ] Create `POST /api/groups/members/add` route — handles real users (with name lookup) and guests (name only, `user_id = null`) in one batch insert. Same pattern as `/api/groups/create`.
- [ ] Update `groups/[id]/page.tsx` add member flow to call the new route instead of `addMembersToGroup`/`createGuestProfile`
- [ ] Remove `createGuestProfile` from `useMembers.ts` (no longer needed)
- [ ] Update `addMembersToGroup` in `useMembers.ts` to pass `name` — or remove it entirely if the route replaces all usages

### 0b. Remove members from group
- [ ] UI — remove button on member row in group detail (visible to group creator only for now)
- [ ] For real users: `UPDATE group_members SET status = 'left'` (preserves expense history)
- [ ] For guests: hard delete the `group_members` row (no history to preserve, no account)
- [ ] `useMembers.ts` — add `useRemoveGroupMember` mutation

### 0c. Group settings screen
- [ ] New route `/groups/[id]/settings` — gear icon in group header opens it
- [ ] Member list with add + remove actions
- [ ] Add member flow (real users + guests) via `POST /api/groups/members/add`
- [ ] Remove member — `status: 'left'` for real users, hard delete for guests
- [ ] Group rename + emoji change
- [ ] Delete group (move from action menu)

### 0d. Group expenses page refinement
- [ ] Review layout, spacing, and information density on the expenses feed
- [x] Payer display — confirm name renders correctly for real users and guests
- [ ] Balance section — verify "who pays who" rows are accurate after schema change
- [x] Activity feed date grouping — confirm headers render correctly
- [x] Empty state when no expenses yet
- [ ] Mobile layout review

### 0e. Expense adding refinement
- [x] Verify `paidById` initializes correctly when `profile` loads after `members`
- [x] Confirm splits sum correctly with `group_member_id` keys
- [ ] Test equal / exact / percentage split modes end to end
- [x] Guest members should appear in paid-by chips and split lists

---

## 1. Supabase setup

### 1a. Create project & configure env
- [x] Create project at supabase.com
- [x] Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `.env.local`
- [x] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (used by the invite decline API route)

### 1b. Run database schema
- [x] Core tables: `profiles`, `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, `notifications`
- [x] `add_code` on profiles, `touch_updated_at` trigger, `handle_new_user` trigger, RLS + policies
- [x] **Schema migration** (`supabase/migrations/20260526000000_handle_member_status.sql`) — ran 2026-05-26:
  - [x] `profiles.handle TEXT UNIQUE`
  - [x] `group_members.status` + `invited_by` + backfill existing rows as `'active'`
  - [x] `expenses.split_type` — `'percentage'` added
  - [x] `expense_history` table + RLS
  - [x] `notifications.group_id` column + `'group_invite_accepted'` in type check
  - [x] All 6 notification triggers
  - [x] `log_expense_edit` trigger

### 1c. Enable Google OAuth
- [x] New Supabase project created — Google OAuth configured on fresh credentials

---

## 2. Wire up auth

- [x] **`src/app/login/LoginButton.tsx`** — email/password form implemented with dev auto-login button (dev-only, Google OAuth is the production auth path)
- [x] **Google OAuth** — working on new project
- [x] **`src/proxy.ts`** — protects all routes, redirects to onboarding if handle is null, carries `?redirect` through the onboarding hop so deep links survive sign-up

---

## 3. Rewire mock-data pages to real Supabase queries ✅

- [x] Group detail page — real balances, who pays who, activity feed, settle/add buttons
- [x] Home page — real global balances, groups panel, recent activity
- [x] Sidebar — real groups list

---

## 4. Add member flow ✅

### 4a. Schema migration (prerequisite — see §1b)
- [x] Add `status` and `invited_by` to `group_members`
- [x] Backfill existing rows: `UPDATE group_members SET status = 'active'`

### 4b. Fix insert/upsert calls
- [x] `useCreateGroup` (`useGroups.ts`) — `status: 'active'` on creator insert
- [x] `useAddGroupMember` (`useMembers.ts`) — `status: 'pending'`, `invited_by` (current user's profile id)
- [x] `addMembersToGroup` (`useMembers.ts`) — `status: 'pending'`, `invited_by`
- [x] `invite/[token]/page.tsx` — upsert with `status: 'active'` (invite-link join = immediately active, no confirmation)

### 4c. Fix read queries ✅ (see also §10)
- [x] `useGroupMembers` — returns pending + active; pending shown with ⏳ badge (intentional — splits and balances include pending members)
- [x] `useGroups` — `.eq('status', 'active')` so left/pending groups don't appear in user's list
- [x] `useProfileGroups` — status filter applied
- [x] `useRecentCollaborators` — `status = 'active'` on both sub-queries
- [x] `useGlobalBalances` — both `group_members` queries filtered to `status = 'active'`
- [x] `useRecentActivity` — memberships query filtered to `status = 'active'`

### 4d. Accept/decline flow ✅
- [x] `useAcceptGroupInvite(groupId)` — UPDATE to `status: 'active'`; trigger fires `group_invite_accepted` to `invited_by`
- [x] `useDeclineGroupInvite(groupId)` — API route (`/api/invite/decline`) uses service role to transfer splits to guest profile, DELETE pending row; trigger fires `group_invite_declined`
- [x] Pending invites surface in Me page — group invite card with Accept / Decline
- [x] ⏳ Pending and 👤 Guest badges in group member list

### 4e. Invite link
- [x] Copy invite link + QR code in `AddMemberModal` right panel
- [x] Invite page rewritten — accept/decline UI, handles pending/new/already-active cases. Decline converts pending member to guest profile.

---

## 5. Notifications ✅

- [x] App-level notification writes removed from `useCreateSettlement`, `useConfirmSettlement`, `useDenySettlement`
- [x] `fromUser` param removed from `useConfirmSettlement` and `useDenySettlement`
- [x] All 6 notification triggers live in DB (deployed 2026-05-26 via migration)
- [x] `invalidateQueries(['notifications'])` kept in confirm/deny hooks so TanStack refetches after trigger fires

---

## 6. Polish / small fixes

- [x] **Display name editing** — `ProfileSettings` section on Me page: display name field + `HandleInput` for handle changes, single save button. `HandleInput` extracted as reusable component used by both Me page and onboarding.
- [x] **Group detail back button** — navigates to `/groups`
- [x] **Home page skeleton** — `HomeScreenSkeleton` shown while balances + activity load
- [x] **Expense splits validation** — `RemainderCounter` in exact and percentage modes blocks save until balanced
- [x] **Empty state for group detail** — shows "No expenses yet — add one to get started."
- [x] **Add expense modal on desktop** — sheet modal (full-screen on mobile, centered card on desktop) opened inline; `/groups/[id]/add` redirects back to group detail

---

## 7. Identity & handle system ✅

### 7a. Database
- [x] `handle TEXT UNIQUE` on `profiles` — in schema, type reflects `handle: string | null`

### 7b. Onboarding screen ✅
- [x] `src/app/onboarding/page.tsx` — name pre-filled, handle input with real-time availability check + suggestion chips + identity preview, Continue writes handle → redirects to home or `?redirect` URL
- [x] `src/proxy.ts` — handle-null → `/onboarding` redirect, `?redirect` chain preserved

### 7c. Email/password form (dev-only — do not ship)
Dev convenience only. `LoginButton.tsx` gates the form behind `NODE_ENV === 'development'`. Will be removed before launch.

### 7d. Search overhaul ✅
- [x] `handle` already in `ProfileSnippet` type
- [x] `useSearchProfiles` — three input modes: `@` prefix → handle fuzzy, 8-char alphanumeric → `add_code` exact, else → name + display_name + handle fuzzy
- [x] `MemberCombobox` result rows show `@handle` below name

---

## 8. Dashboard balance cards

- [x] **Simplify cards** — gross amounts per card (`grossOwedToMe` / `grossIOwe` in `useGlobalBalances`), not pairwise-netted
- [x] **Balance invalidation** — `useAddExpense`, `useCreateSettlement`, `useConfirmSettlement`, `useDenySettlement` all invalidate `['global-balances']`
- [x] **Expand button** — opens modal with full per-person breakdown (who owes what, across which groups)

---

## 9. Split modes ✅

- [x] `equal` — amount / member count, rounding remainder to first person. Member toggle (click to include/exclude).
- [x] `exact` — $ input per member, % of total shown below name. RemainderCounter blocks save until balanced.
- [x] `percentage` — % input per member, $ equivalent shown below name. RemainderCounter blocks save until 100%. `makePercentSplits` in `lib/splits.ts` handles rounding.
- [ ] `itemized` (receipt scan) — Phase 3. Placeholder tab shown in add expense form.

---

## 10. group_members status filter audit ✅

All queries fixed. See §4c.

| File | Function | Status |
|---|---|---|
| `src/queries/useGroups.ts` | `useGroups` | ✅ |
| `src/queries/useGroups.ts` | `useGroupMembers` | ✅ (returns pending+active; pending shown with badge) |
| `src/queries/useGroups.ts` | `useProfileGroups` | ✅ |
| `src/queries/useGroups.ts` | `useCreateGroup` | ✅ |
| `src/queries/useGlobalBalances.ts` | `useGlobalBalances` | ✅ |
| `src/queries/useGlobalBalances.ts` | `useRecentActivity` | ✅ |
| `src/queries/useMembers.ts` | `useRecentCollaborators` | ✅ |
| `src/app/invite/[token]/page.tsx` | InvitePage | ✅ |

---

## 11. Hooks extraction

Extract business logic out of fat components into `src/hooks/`. Goal: components contain only JSX, event wiring, and presentational UI state.

**Convention:**
- Navigation via `onSuccess` callback — never import `next/navigation` inside a hook
- Never write to `notifications` in a hook — DB triggers handle all notification inserts
- Naming: `queries/` holds raw fetching hooks; `hooks/` composes them with local state

**Extract these:**
- [ ] `useSettleUp` — pre-fill from debt simplification, amount/payee state, validation. Lives in `hooks/useSettleUp.ts`.
- [ ] `useCreateGroup` — name/emoji form state + mutation. Lives in `hooks/useCreateGroup.ts`.
- [ ] `useMemberSearch` — debounce, three input modes (@handle / add_code / fuzzy), query gating. Extract alongside §7d. Lives in `hooks/useMemberSearch.ts`.

**Skip — pure query composition, no second consumer yet:**
- `useGroupDetail`, `useGroupsList`, `useHome` — call query hooks directly in the component. Add a screen hook only if a second consumer appears.

---

## 13. Add expense form polish

- [ ] Center the amount display on mobile (the `$0.00` hero is left-aligned after recent changes)
- [ ] End-to-end add expense flow — open sheet → enter amount → fill description → pick paid by → save → confirm expense appears in feed
- [ ] Keypad "00" behavior — verify it doesn't overflow the max cents guard
- [ ] Date field — confirm it appears and saves correctly on mobile (currently desktop-only tile)

---

## 14. Mobile group view

- [ ] Group detail page on mobile — layout, spacing, scroll behavior
- [ ] Balance hero on mobile — size and legibility at small viewport
- [ ] Who pays who rows — confirm tap targets and avatar sizing
- [ ] Activity feed — date group headers, item density on small screens
- [ ] Add member inline — `MemberCombobox` keyboard + chip layout on mobile

---

## 15. Mobile nav redesign

- [ ] Tab bar — review active state, icon set, label sizing, and safe area handling
- [ ] FAB — placement, tap target, and whether it still belongs as a standalone button vs. inline in the tab bar
- [ ] Active route highlighting — ensure current tab is visually distinct across all four routes

---

## 16. Group creation redesign

- [ ] `/groups/new` page — review layout on mobile (currently full-page form, may need bottom-sheet treatment)
- [ ] Emoji picker — evaluate current implementation, consider a scrollable grid sheet
- [ ] Member search inline — `MemberCombobox` flow on mobile; confirm keyboard dismiss + chip layout work at small sizes
- [ ] Success state — after creation, confirm redirect to group detail feels right

---

## 17. Wire up group creation route ✅

- [x] `POST /api/groups/create` is written but not wired up — `useCreateGroup` in `useGroups.ts` and `handleCreate` in `groups/new/page.tsx` still use the old direct Supabase client flow
- [x] Update `useCreateGroup` to call the route instead of direct inserts
- [x] Update `handleCreate` to pass the full member list (real users + guests) to the hook
- [x] Remove `createGuestProfile` and `addMembersToGroup` calls from `new/page.tsx`

---

## 18. Auth session sharing

- [ ] Each TanStack Query calls `getAuthUser` independently → multiple `supabase.auth.getSession()` calls fire simultaneously on `refetchOnWindowFocus`, hitting Supabase auth rate limit. Fix: share a single session across all queries via a context or a dedicated `useSession` hook that all other queries consume.

---

## 12. Later (Phase 2+, don't build yet)

- Public expense share page (`/expense/[share_token]`) — skeleton exists, needs service-role fetch
- QR code / add by code (`/add/[add_code]`) — skeleton exists
- Display name editing — Me page (tracked in §6)
- Guest profiles
- Group settings page (creator as admin, toggleable member permissions)
- Expense editing + history view (`expense_history` table is in schema, UI deferred)
- Leave group flow (`status: 'left'` is in schema, UI deferred)
- Cross-group "Settle all with [person]" (see CLAUDE.md architecture section)
- Full activity feed tab (`/activity` page)
- Receipt scanning / OCR (`/api/ocr`) — Phase 3, wires into `itemized` split type
- **Currency options** — `currency_code` already stored per expense. UI: currency picker in add expense form, display symbol alongside amounts.
- **Payment method on settlements** — `payment_method` column on `settlements`, picker in settle up form, shown in activity feed.
- **Comments on expenses** — `expense_comments` table, thread UI per expense.
- **Recurring expenses** — `repeat_interval` on expenses, Edge Function cron to auto-create next instance.
