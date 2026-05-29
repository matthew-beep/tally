# TODO

## 1. Supabase setup

### 1a. Create project & configure env
- [x] Create project at supabase.com
- [x] Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `.env.local`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (used by the public `/expense/[share_token]` page)

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
- [ ] Supabase → Authentication → Providers → Google (suspended — credentials leaked, appeal pending)
- [ ] Create OAuth app in Google Cloud Console, paste client ID + secret into Supabase
- [ ] Set callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
- [ ] Add `http://localhost:3000` to allowed redirect URLs

---

## 2. Wire up auth

- [x] **`src/app/login/LoginButton.tsx`** — email/password form implemented with dev auto-login button (dev-only, Google OAuth is the production auth path)
- [ ] **Google OAuth** — restore `signInWithOAuth` once appeal is approved
- [x] **`src/middleware.ts`** — created. Protects all routes, redirects to onboarding if handle is null, carries `?redirect` through the onboarding hop so deep links survive sign-up

---

## 3. Rewire mock-data pages to real Supabase queries ✅

- [x] Group detail page — real balances, who pays who, activity feed, settle/add buttons
- [x] Home page — real global balances, groups panel, recent activity
- [x] Sidebar — real groups list

**Note:** These queries were written before `group_members.status` existed. They will include pending/left members once the schema migration runs. See §10 for the full status-filter audit — fix those before or alongside the §1b migration.

---

## 4. Add member flow ⚠️ REOPENED — current implementation is wrong

The flow was built before the `group_members.status` model was decided. Direct inserts without `status`/`invited_by` and no accept/decline flow are incorrect per CLAUDE.md.

**What's wrong:**
- `useAddGroupMember` (`src/queries/useMembers.ts:11`) — upserts without `status` or `invited_by`. Once migration runs, members land as `'pending'` with no `invited_by`, breaking the accept/decline flow.
- `addMembersToGroup` (`src/queries/useMembers.ts:57`) — same issue, used during group creation for non-creator members.
- `useCreateGroup` (`src/queries/useGroups.ts:92`) — inserts creator without `status: 'active'`. Once migration runs, the group creator will be pending in their own group — critical bug.
- `useGroupMembers` (`src/queries/useGroups.ts:49`) — no status filter. Returns pending and left members as full members.
- `useRecentCollaborators` (`src/queries/useMembers.ts:32,39`) — no status filter on either sub-query. Shows collaborators from left groups and pending members.
- `src/app/invite/[token]/page.tsx:30` — upserts without `status: 'active'`. Invite-link joins must be immediately active, not pending.
- No accept/decline flow exists anywhere.
- No ⏳ pending badge in group member list.

### 4a. Schema migration (prerequisite — see §1b)
- [ ] Add `status` and `invited_by` to `group_members`
- [ ] Backfill existing rows: `UPDATE group_members SET status = 'active'`

### 4b. Fix insert/upsert calls
- [x] `useCreateGroup` (`useGroups.ts:92`) — add `status: 'active'` to creator insert
- [x] `useAddGroupMember` (`useMembers.ts:11`) — add `status: 'pending'`, `invited_by` (current user's profile id)
- [x] `addMembersToGroup` (`useMembers.ts:57`) — add `status: 'pending'`, `invited_by`
- [x] `invite/[token]/page.tsx:30` — upsert with `status: 'active'` (invite-link join = immediately active, no confirmation)

### 4c. Fix read queries (see also §10)
- [ ] `useGroupMembers` — add `.eq('status', 'active')` (show pending separately for organiser view, tagged ⏳)
- [ ] `useGroups` — add `.eq('status', 'active')` so left/pending groups don't appear in list
- [ ] `useProfileGroups` — add status filter
- [ ] `useRecentCollaborators` — add `AND status = 'active'` to both sub-queries
- [ ] `useGlobalBalances` — both `group_members` queries need `.eq('status', 'active')` (see §10)
- [ ] `useRecentActivity` — memberships query needs `.eq('status', 'active')` (see §10)

### 4d. Accept/decline flow (not built yet)
- [x] `useAcceptGroupInvite(groupId)` — `UPDATE group_members SET status = 'active'` where `group_id = X AND user_id = me`; trigger fires `group_invite_accepted` to `invited_by`
- [x] `useDeclineGroupInvite(groupId)` — `DELETE` row where `group_id = X AND user_id = me AND status = 'pending'`; trigger fires `group_invite_declined` to `invited_by`
- [x] Pending invites surface in Me page — show group invite card with Accept / Decline
- [x] ⏳ Pending and 👤 Guest badges in group member list

### 4e. Invite link
- [x] Copy invite link + QR code in `AddMemberModal` right panel
- [x] Invite page rewritten — accept/decline UI, handles pending/new/already-active cases. Decline converts pending member to guest profile.

---

## 5. Notifications ✅

- [x] App-level notification writes removed from `useCreateSettlement`, `useConfirmSettlement`, `useDenySettlement`
- [x] `fromUser` param removed from `useConfirmSettlement` and `useDenySettlement` (was only needed for manual writes)
- [x] All 6 notification triggers live in DB (deployed 2026-05-26 via migration)
- [x] `invalidateQueries(['notifications'])` kept in confirm/deny hooks so TanStack refetches after trigger fires

---

## 6. Polish / small fixes

- [ ] **Display name editing** — Me page has no way to set `display_name`. Add an inline edit or simple form field.
- [x] **Group detail back button** — navigates to `/groups`
- [ ] **Home page layout** — currently uses a desktop multi-column layout (different from the DashboardPage wrapper used everywhere else); consider aligning it
- [ ] **Expense splits sum validation** — in exact and percentage split mode, show a running total/remainder counter so the user knows if amounts are balanced before hitting save
- [x] **Empty state for group detail** — shows "No expenses yet — add one to get started."

---

## 7. Identity & handle system

Full spec is now in CLAUDE.md (Auth section, Identity model, Member search sections).

### 7a. Database
- [ ] Add `handle TEXT UNIQUE` to `profiles` (in §1b migration list)
- [ ] `handle_new_user` trigger already leaves handle NULL — no change needed

### 7b. Onboarding screen
- [ ] Create `src/app/onboarding/page.tsx` — name pre-filled (read-only), handle input with real-time availability check, Continue writes handle to DB → redirects to home or `?redirect` URL
- [ ] Create `src/middleware.ts` (see §2) — includes handle-null → `/onboarding` redirect logic

### 7c. Email/password form (dev-only — do not ship)
The existing form is a dev convenience. Google OAuth is the production auth path. Do not add handle fields to it. It will be removed when Google OAuth is restored.

### 7d. Search overhaul
- [ ] Add `handle` to `ProfileSnippet` type (keep `add_code` — it's permanent for QR, never changes even if handle does)
- [ ] Update `useSearchProfiles` — three input modes: `@` prefix → handle fuzzy, 8-char alphanumeric → `add_code` exact, else → name + handle fuzzy
- [ ] Update `MemberCombobox` search result rows — show `@handle` alongside name and avatar

---

## 8. Dashboard balance cards

- [x] **Simplify cards** — single total number per card. "Owed to you" and "You owe" show gross amounts (not pairwise-netted) so both sides of a relationship are visible even when net balance swings negative. Computed via `grossOwedToMe` / `grossIOwe` in `useGlobalBalances`.
- [x] **Balance invalidation** — `useAddExpense`, `useCreateSettlement`, `useConfirmSettlement`, `useDenySettlement` all now invalidate `['global-balances']` on success.
- [ ] **Add expand button** — opens modal with full per-person breakdown (who owes what, across which groups)

---

## 9. Split modes

Four modes. Only `equal` is implemented. All four write to `expense_splits` — `split_type` determines how `owed_amount` is calculated before insert.

- [x] `equal` — amount / member count, rounding remainder to first person
- [ ] `exact` — each person's amount entered manually. Validation: sum must equal expense total before save.
- [ ] `percentage` — each person assigned a %. Validation: must sum to 100. `owed_amount = (pct / 100) * total`. **Requires schema update: `'percentage'` added to `expenses.split_type` CHECK — in §1b migration list.**
- [ ] `itemized` (receipt scan) — line items assigned to members, tax/tip distributed proportionally. Full spec in CLAUDE.md. Phase 3 (receipt scanning pre-fills this flow).

UI rule for exact + percentage: show a running total/percentage-remaining counter in the form — user must see balance before saving.

---

## 10. group_members status filter audit ⚠️ Bug-waiting-to-happen

Every `group_members` query missing `status = 'active'` will silently include pending and left members once the §1b migration runs. Fix these **before or alongside** the migration. Fix rule: any read from `group_members` must include `.eq('status', 'active')` unless it's explicitly showing pending invites.

| File | Function | Line | Issue |
|---|---|---|---|
| `src/queries/useGroups.ts` | `useGroups` | 16 | ✅ Fixed |
| `src/queries/useGroups.ts` | `useGroupMembers` | 49 | ✅ Fixed |
| `src/queries/useGroups.ts` | `useProfileGroups` | 65 | ✅ Fixed |
| `src/queries/useGroups.ts` | `useCreateGroup` | 92 | ✅ Fixed |
| `src/queries/useGlobalBalances.ts` | `useGlobalBalances` | 25 | ✅ Fixed |
| `src/queries/useGlobalBalances.ts` | `useGlobalBalances` | 45 | ✅ Fixed |
| `src/queries/useGlobalBalances.ts` | `useRecentActivity` | 106 | ✅ Fixed |
| `src/queries/useMembers.ts` | `useRecentCollaborators` | 32 | ✅ Fixed |
| `src/queries/useMembers.ts` | `useRecentCollaborators` | 39 | ✅ Fixed |
| `src/app/invite/[token]/page.tsx` | InvitePage | 30 | ✅ Fixed |

---

## 11. Hooks extraction

Extract business logic out of fat components into `src/hooks/`. Goal: components contain only JSX, event wiring, and presentational UI state. Hooks contain queries, mutations, derived values, and form state.

**Convention:**
- Navigation via `onSuccess` callback — never import `next/navigation` inside a hook
- Never write to `notifications` in a hook — DB triggers handle all notification inserts
- Naming: `queries/` holds raw fetching hooks; `hooks/` composes them with local state
- `category` in add-expense is `useState` seeded from `detectCategory`, not a pure derived value (user can override)

**Extract these — they have real form/interaction state worth isolating:**

- [ ] `useAddExpense` — 9 `useState`, split-building logic, category override. Extract alongside §9 (split modes) since you'll be in that file anyway. Lives in `hooks/useAddExpense.ts`.
- [ ] `useSettleUp` — pre-fill from debt simplification, amount/payee state, validation. Lives in `hooks/useSettleUp.ts`.
- [ ] `useCreateGroup` — name/emoji form state + mutation. Lives in `hooks/useCreateGroup.ts`.
- [ ] `useMemberSearch` — debounce, three input modes (@handle / add_code / fuzzy), query gating. Extract alongside §7d (search overhaul). Lives in `hooks/useMemberSearch.ts`.

**Write hooks-first for new flows (don't retrofit, just build correctly from the start):**
- `useAcceptGroupInvite` / `useDeclineGroupInvite` — already listed in §4d

**Skip — pure query composition, no second consumer yet:**
- `useGroupDetail`, `useGroupsList`, `useHome` — call query hooks directly in the component, `useMemo` the derived values. Add a screen hook only if a second consumer appears.

---

## 12. Later (Phase 2+, don't build yet)

- Public expense share page (`/expense/[share_token]`) — skeleton exists, needs service-role fetch
- QR code / add by code (`/add/[add_code]`) — skeleton exists
- Profile display name settings (tracked in §6)
- Guest profiles
- Group settings page (creator as admin, toggleable member permissions)
- Expense editing + history view (`expense_history` table is in schema, UI deferred)
- Leave group flow (`status: 'left'` is in schema, UI deferred)
- Cross-group "Settle all with [person]" (see CLAUDE.md architecture section)
- Full activity feed tab (`/activity` page)
- Receipt scanning / OCR (`/api/ocr`) — Phase 3, wires into `itemized` split type
