# TODO

## 1. Supabase setup (nothing done yet — do this first)

### 1a. Create project & configure env
- [ ] Create project at supabase.com
- [ ] Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `.env.local`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (used by the public `/expense/[share_token]` page)

### 1b. Run database schema
Run the schema from `CLAUDE.md` in the Supabase SQL editor, plus these additions:

- [ ] Core tables: `profiles`, `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, `notifications`
- [ ] Add `add_code text UNIQUE` column to `profiles` — referenced in `src/types/index.ts` and `me/page.tsx` but missing from the CLAUDE.md schema SQL
- [ ] Add the `touch_updated_at` trigger on `expenses`
- [ ] Add the `handle_new_user` trigger on `auth.users` — auto-creates a `profiles` row on sign-up. Also generate `add_code` here (e.g. `substr(md5(random()::text), 1, 8)`)
- [ ] Enable RLS + add policies on `expenses`, `expense_splits`, `settlements`, `expense_items`, `expense_item_assignments` (group members only — see CLAUDE.md)

### 1c. Enable Google OAuth
- [ ] Supabase → Authentication → Providers → Google
- [ ] Create OAuth app in Google Cloud Console, paste client ID + secret into Supabase
- [ ] Set callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
- [ ] Add `http://localhost:3000` to allowed redirect URLs

---

## 2. Wire up auth (two stubs to fix)

- [ ] **`src/app/login/LoginButton.tsx`** — replace `router.push('/')` with the real `signInWithOAuth` call:
  ```ts
  const supabase = createClient()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
    },
  })
  ```
  Also restore `useSearchParams` and `createClient` imports.

- [ ] **`middleware.ts`** — doesn't exist yet. Create `src/middleware.ts` using the pattern from CLAUDE.md to protect all routes except `/login`, `/invite`, `/expense`.

---

## 3. Rewire mock-data pages to real Supabase queries ⭐ biggest task

Two pages still use `src/lib/mockData.ts` instead of the real query hooks:

### 3a. Group detail page — `src/app/(dashboard)/groups/[id]/page.tsx`
This is the core of the app. Replace the whole mock implementation with real data using existing hooks (`useGroup`, `useGroupMembers`, `useExpenses`, `useSettlements`, `calcNetBalances`, `simplifyDebts`). The UI design is done — just swap the data source.
- [ ] Show real balance hero (user's net balance in the group)
- [ ] Show real "Who pays who" (simplified debt list)
- [ ] Show real activity feed (merged expenses + settlements, sorted by `created_at`)
- [ ] Wire "Settle up" button → `router.push('/groups/${groupId}/settle')`
- [ ] Wire "+ Add expense" button → `router.push('/groups/${groupId}/add')`

### 3b. Home page — `src/app/(dashboard)/page.tsx`
- [ ] Replace mock global balances with real cross-group balance calculation (query all groups the user is in, then aggregate)
- [ ] Replace mock groups panel with real `useGroups()` data
- [ ] Replace mock activity feed with real expenses/settlements from all groups

---

## 4. Add member flow (not yet built)

Currently you can create a group but can't add other users to it. MVP needs member search.

- [ ] Build member search UI — search box that calls a Supabase query matching `name`, `display_name`, or `email ILIKE` (see CLAUDE.md "Member search query")
- [ ] Add a query hook `useAddMember(groupId)` that inserts into `group_members`
- [ ] Surface the add member UI somewhere in group detail (e.g. a "+ Invite" button that opens a modal)
- [ ] Copy invite link button — group's `invite_token` as `tally.app/invite/:token`

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
