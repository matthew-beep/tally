# TODO

## 1. Supabase setup (nothing done yet — do this first)

### 1a. Create project & configure env
- [x] Create project at supabase.com
- [x] Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `.env.local`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (used by the public `/expense/[share_token]` page)

### 1b. Run database schema
- [x] Core tables: `profiles`, `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, `notifications`
- [x] `profiles.id = auth.users.id` — simplified identity model, no two-UUID bridging
- [x] `add_code` on profiles, `touch_updated_at` trigger, `handle_new_user` trigger, RLS + policies

### 1c. Enable Google OAuth
- [ ] Supabase → Authentication → Providers → Google (suspended — credentials leaked, appeal pending)
- [ ] Create OAuth app in Google Cloud Console, paste client ID + secret into Supabase
- [ ] Set callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
- [ ] Add `http://localhost:3000` to allowed redirect URLs

---

## 2. Wire up auth

- [x] **`src/app/login/LoginButton.tsx`** — email/password form implemented with dev auto-login button
- [ ] **Google OAuth** — restore `signInWithOAuth` once appeal is approved
- [ ] **`middleware.ts`** — doesn't exist yet. Create `src/middleware.ts` using the pattern from CLAUDE.md to protect all routes except `/login`, `/invite`, `/expense`.

---

## 3. Rewire mock-data pages to real Supabase queries ✅

- [x] Group detail page — real balances, who pays who, activity feed, settle/add buttons
- [x] Home page — real global balances, groups panel, recent activity
- [x] Sidebar — real groups list

---

## 4. Add member flow (not yet built)

Currently you can create a group but can't add other users to it. Full flow described below.

### 4a. Recents hook
- [ ] Create `src/queries/useRecents.ts` — queries all group members across the user's groups, joins profiles, sorts by most recent shared expense. Cached by TanStack Query (60s stale time). Excludes self.

### 4b. MemberPicker component
- [ ] Create `src/components/MemberPicker.tsx`
  - Props: `selected: Profile[]`, `onChange: (profiles: Profile[]) => void`, `excludeIds?: string[]`
  - Shows recents list immediately on open (from `useRecents()`)
  - Typing filters recents client-side first
  - 2+ chars fires `useSearchProfiles(query)` for server results
  - Recents matches at top, server results below
  - Selected people shown as removable chips at top
  - Opens as a bottom sheet

### 4c. Group creation with members
- [ ] Update `useCreateGroup` in `src/queries/useGroups.ts` to accept `memberIds: string[]`
  - Sequence: insert group → insert creator → insert each member into `group_members`
- [ ] Update `src/app/(dashboard)/groups/new/page.tsx` to include MemberPicker
  - Creator shown as non-removable chip
  - "Add people" button opens picker sheet
  - Selected members shown as chips in form
  - All written to DB in one shot on "Create"

### 4d. Add member to existing group
- [ ] Add `useAddGroupMember(groupId)` mutation to `src/queries/useGroups.ts`
  - Inserts one row into `group_members`, invalidates `['group_members', groupId]`
- [ ] Add "+ Add" button near member avatars on group detail page
  - Opens MemberPicker sheet with `excludeIds` set to current members
  - Tap a person → mutation fires immediately, no confirm step

### 4e. Invite link (nice to have)
- [ ] Copy invite link button on group detail — copies `tally.app/invite/[invite_token]` to clipboard

---

## 5. Notifications write-path (DB side missing)

The Me page UI for confirming/denying settlements is built, but nothing writes notifications to the DB:

- [ ] When a settlement is created → insert a `settlement_confirm` notification for the payee (`to_user`)
- [ ] When a settlement is confirmed → insert a `settlement_confirmed` notification for the payer (`from_user`), mark the original notification as read
- [ ] When a settlement is denied → insert a `settlement_denied` notification for the payer, delete the settlement row

This logic lives in `src/queries/useSettlements.ts` — add the notification inserts to `useCreateSettlement`, `useConfirmSettlement`, and `useDenySettlement`.

---

## 6. Polish / small fixes

- [ ] **Display name editing** — Me page has no way to set `display_name`. Add an inline edit or a simple form field.
- [ ] **Group detail back button** — currently navigates to `/` (hardcoded); should navigate to `/groups` or use `router.back()`
- [ ] **Home page layout** — currently uses a desktop multi-column layout (different from the DashboardPage wrapper used everywhere else); consider aligning it
- [ ] **Expense splits sum validation** — in exact split mode, show a running total so the user knows if their amounts don't add up to the expense total before hitting save
- [ ] **Empty state for group detail** — no expenses yet? Show a friendly prompt.

---

## 7. Later (Phase 2+, don't build yet)

- Invite link flow (`/invite/[token]`) — skeleton exists, needs real join logic
- Public expense share page (`/expense/[share_token]`) — skeleton exists, needs service-role fetch
- QR code / add by code (`/add/[add_code]`) — skeleton exists
- Profile display name settings
- Guest profiles
- Itemized split
