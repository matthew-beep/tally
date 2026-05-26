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

## 4. Add member flow ⚠️ UX under review

Built but the UX for group creation + adding members is being redesigned. See discussion notes below.

### 4a. Recents hook
- [x] `useRecentCollaborators` in `src/queries/useMembers.ts` — queries all group members across the user's groups, deduped, excludes self

### 4b. MemberPicker component
- [x] `src/components/AddMemberModal.tsx` — recents + search (2+ chars), selected chips, add code recognition, built as a portal modal

### 4c. Group creation with members
- [x] `addMembersToGroup` utility in `src/queries/useMembers.ts` — bulk upsert into `group_members`
- [x] `NewGroupModal` wired: creates group then calls `addMembersToGroup` for selected members

### 4d. Add member to existing group
- [x] `useAddGroupMember(groupId)` in `src/queries/useMembers.ts`
- [x] "+ Add" button on group detail page opens `AddMemberModal` with `existingMemberIds`

### 4e. Invite link
- [x] Copy invite link + QR code in `AddMemberModal` right panel (group context only)

### UX redesign discussion
The current flow (nested `AddMemberModal` inside `NewGroupModal`) has a gap: new users with no recents see an empty state during group creation, and the invite link (which needs `invite_token`) isn't available until after the group exists. Three options being evaluated:
- **A** — Defer member-adding entirely to after group creation (group detail page has full recents + search + invite link)
- **B** — Two-step modal: step 1 creates the group, modal transitions to step 2 with recents + search + invite link/QR
- **C** — Single modal with invite link shown after save

---

## 5. Notifications write-path ✅

- [x] Settlement created → inserts `settlement_confirm` notification for payee (`to_user`) in `useCreateSettlement`
- [x] Settlement confirmed → inserts `settlement_confirmed` notification for payer (`from_user`) in `useConfirmSettlement`
- [x] Settlement denied → inserts `settlement_denied` notification for payer, deletes settlement row in `useDenySettlement`

---

## 6. Polish / small fixes

- [ ] **Display name editing** — Me page has no way to set `display_name`. Add an inline edit or a simple form field.
- [x] **Group detail back button** — navigates to `/groups`
- [ ] **Home page layout** — currently uses a desktop multi-column layout (different from the DashboardPage wrapper used everywhere else); consider aligning it
- [ ] **Expense splits sum validation** — in exact split mode, show a running total so the user knows if their amounts don't add up to the expense total before hitting save
- [x] **Empty state for group detail** — shows "No expenses yet — add one to get started."

---

## 7. Identity & handle system

Full spec: [`docs/identity-and-search-spec.md`](docs/identity-and-search-spec.md)

### 7a. Database
- [ ] Add `handle TEXT UNIQUE` column to `profiles`
- [ ] Update `handle_new_user` trigger — leave handle as `NULL` on creation (suggested client-side)
- [ ] Add RLS policy allowing authenticated users to insert guest profiles (`user_id = NULL, status = 'guest'`)

### 7b. Onboarding — Google OAuth (new user)
- [ ] Create `src/app/onboarding/page.tsx` — single screen, name pre-filled (read-only), handle input with real-time availability check, Continue button writes handle to DB
- [ ] Update `src/middleware.ts` — after auth check, if `profile.handle === null` redirect to `/onboarding`

### 7c. Signup — email/password (new user)
- [ ] Update `src/app/login/LoginButton.tsx` signup form — add first name, last name, handle fields. Handle auto-suggested from first name as user types. Writes everything on submit.

### 7d. Search overhaul
- [ ] Add `handle` to `ProfileSnippet` type, remove `add_code` from it
- [ ] Update `useSearchProfiles` — three modes based on input: `@` prefix → handle fuzzy, 8-char alphanumeric → add code exact, else → name + handle fuzzy
- [ ] Update `MemberCombobox` search result rows — show `@handle` instead of `add_code`

---

## 8. Dashboard balance cards

- [ ] **Simplify "owed to you" and "you owe" cards** — currently show individual breakdowns per person. Change to a single total number per card (e.g. "You are owed $47.50" / "You owe $23.00")
- [ ] **Add expand button** — small button top-right of each card opens a modal showing the full per-person breakdown (who owes what, across which groups)

---

## 9. Later (Phase 2+, don't build yet)

- Invite link flow (`/invite/[token]`) — skeleton exists, needs real join logic
- Public expense share page (`/expense/[share_token]`) — skeleton exists, needs service-role fetch
- QR code / add by code (`/add/[add_code]`) — skeleton exists
- Profile display name settings
- Guest profiles
- Itemized split
