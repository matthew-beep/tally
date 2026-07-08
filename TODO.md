# TODO

Completed phases (Supabase setup, auth, member-status model, notifications,
handle/identity system, settle-up rework, status-filter audit) have been
pruned — see `docs/` for how the shipped systems work and git history for the
old checklists.

---

## 1. Bugs 🐞

- [ ] **`POST /api/invite/decline` is broken post-migration** — still writes
  `expense_splits.user_id` (column dropped in `20260621000000_group_member_model.sql`)
  and inserts a `group_members` row without the now-NOT-NULL `name`. Fails at
  runtime for any decline where the invitee is already in expenses. Rewrite
  against the member model: converting a member to a guest is just
  `UPDATE group_members SET user_id = NULL` (splits already point at the
  member row) — no guest profile, no split transfer, no re-insert needed.
- [ ] **`useAddGroupMember` (`src/queries/useMembers.ts`) is legacy** — upserts
  `group_members` without `name` (NOT NULL violation on fresh inserts). UI
  paths use `POST /api/groups/members/add`; remove the hook or fix it, and
  check `AddMemberModal` no longer calls it.
- [ ] **`ExpenseActionSheet` split header hardcodes "Split equally · $X each"**
  regardless of `split_type` — misleading for exact/percentage expenses.

---

## 2. Expense editing (§20) — remaining

Shipped: action sheet → edit drawer (amount / description / payer, splits
rescaled proportionally, `useUpdateExpense`) and delete-confirmation sheet →
soft delete. `expense_history` is populated by the `log_expense_edit` trigger.
"(edited)" label ships on the group detail feed and Activity tab
(`updated_at != created_at`).

- [ ] **Edit history drawer** — tap "(edited)" → sheet listing `expense_history`
  snapshots (edited_by name, date, old amount/description). Needs a read hook.
- [ ] **Split editing** — edit drawer keeps split membership read-only; editing
  who's in the split / split mode means re-running the full split builder
  (reuse `AddExpenseForm` machinery)

---

## 3. Polish / small fixes

- [ ] **Display name editing** — Me page has no way to set `display_name`
  (`useUpdateProfile` already supports it)
- [ ] **Home page layout** — desktop multi-column layout differs from the
  `DashboardPage` wrapper used elsewhere; consider aligning (see §7)
- [ ] **Balance cards expand button** — modal with full per-person breakdown
  (who owes what, across which groups)

---

## 4. Split modes

`equal`, `exact`, `percentage` shipped (running remainder counters included).

- [ ] `itemized` — line items assigned to members, tax/tip distributed
  proportionally. Requires `expense_items` + `expense_item_assignments` tables
  (not yet created). Mobile builder UI exists as a non-saving preview in
  `AddExpenseForm`. Phase 3 receipt scanning pre-fills this flow.

---

## 5. Notifications — remaining

- [ ] **Unread count badge on nav bell** — single-int query,
  `refetchInterval: 30_000` while tab active (per CLAUDE.md sync rules)

---

## 6. App-level data prefetch

**Problem:** `useGlobalBalances` only runs on the home page. Deep-linked pages
lack cross-group balance data, so avatar taps on the group detail balance card
have nothing to show.

- [ ] Create `src/components/GlobalDataPrefetch.tsx` — calls
  `useCurrentProfile` + `useGlobalBalances` once on app load
- [ ] Mount inside `<Providers>` in `src/app/layout.tsx`
- [ ] Wire avatar tap in group detail balance card expanded rows →
  `PersonProfileSheet` using cached global balances

---

## 7. Desktop / web layout — remaining

Sidebar/tab-bar responsive split is done (breakpoint 1024px, `dashboard.css`).
Group detail 2-column layout (§19) shipped.

- [ ] **Home dashboard 3-column layout** — reference `home-overview.jsx` in the
  design project. Left 340px: compact balance hero + groups mini-list;
  middle flex: recent activity; right 285px: per-person "Up Next" owe/owed
  action cards. Single column below 1024px. All data already fetched —
  layout + rendering task only. (Full column-by-column spec lived in TODO
  §18 — see git history if needed.)
- [ ] **Modal sizing** — sheets render full-screen on mobile; on desktop they
  should be centered, max-width ~480px, with backdrop (most flows use
  `ModalOrSheet` already — audit stragglers)
- [ ] **19e** — convert `ExpenseActionSheet` from floating cards to a Vaul
  bottom sheet (`Sheet` component) for drag-to-dismiss + spring animation
- [ ] **19f** — group action menu: wire "Group settings" and "Leave group"
  once those flows exist (§8)

---

## 8. Group settings

Creator (`created_by`) is the admin.

- [ ] **Route** — `src/app/(dashboard)/groups/[id]/settings/page.tsx`
- [ ] **Rename group** — name + emoji picker
- [ ] **Invite link** — show + copy + regenerate `invite_token`
- [ ] **Member management** — admin removes members (`status: 'left'`),
  cancels pending invites (DELETE row)
- [ ] **Leave group** — non-admin: `status: 'left'`; warn on outstanding balance
- [ ] **Delete group** — admin only, only when all balances are $0.00
- [ ] **Wire "Group settings" nav item** in `GroupActionMenu`

---

## 9. Hooks extraction

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
- [ ] `useMemberSearch` — debounce, three input modes, query gating

**Skip:** `useGroupDetail`, `useGroupsList`, `useHome` — pure query
composition with no second consumer.

---

## 10. Later (Phase 2+/3)

- Public expense share page (`/expense/[share_token]`) — skeleton exists,
  needs service-role fetch
- Guest claim flow (`claim_token`, email match, manual link)
- "Former member" display for left members
- Cross-group "Settle all with [person]"
- Receipt scanning / OCR (`/api/ocr`) — Phase 3, feeds `itemized`
- Expense reactions, group leaderboards
- Email notifications, dark-mode toggle surface, PWA/offline
