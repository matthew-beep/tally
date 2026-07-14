# TODO

Completed phases (Supabase setup, auth, member-status model, notifications,
handle/identity system, settle-up rework, status-filter audit) have been
pruned — see `docs/` for how the shipped systems work and git history for the
old checklists.

**Legend:** 🟢 = mechanical / well-specified — Claude can run it solo.
🟡 = needs Matthew's oversight — a product/UX decision, prod credentials, or
a design reference.

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
  `joined_at`; guests insert with `invited_by NULL` so only real-user
  invites count. 429 + `Retry-After: 3600` when hit.
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

### 5. Group settings + leave group 🟡 (product decisions throughout)

Creator (`created_by`) is the admin.

- [ ] **Route** — `src/app/(dashboard)/groups/[id]/settings/page.tsx`
- [ ] **Rename group** — name + emoji picker
- [ ] **Invite link** — show + copy + regenerate `invite_token`
- [ ] **Member management** — admin removes members (`status: 'left'`),
  cancels pending invites (DELETE row — safe only while pending has no
  splits; reuse the decline route's history check)
- [ ] **Leave group** — non-admin: `status: 'left'`; warn on outstanding balance
- [ ] **Delete group** — admin only, only when all balances are $0.00
- [ ] **Wire "Group settings" + "Leave group"** nav items in `GroupActionMenu`
  (menu items exist, no flows behind them)

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

- [ ] **Audit RLS coverage + capture a baseline migration** 🟡 — migrations
  start at `20260526`; the core tables (profiles, groups, group_members,
  expenses, expense_splits, notifications) were created outside version
  control. From the repo, only `expense_history` has `ENABLE ROW LEVEL
  SECURITY` and only expenses/settlements have policies — the real RLS state
  of every other table is unknowable without inspecting prod. Run
  `npx supabase db diff --linked` to snapshot the live schema into a baseline
  migration, then verify every client-reachable table has RLS + policies.
- [ ] **Switch API routes from `getSession()` to `getUser()`** 🟢 — all three
  routes trust the unverified local JWT; `src/proxy.ts:33` documents exactly
  why not to. Mechanical swap.
- [ ] **Global mutation error surface** 🟢 — zero `onError` handling in any
  query hook and no `error.tsx` anywhere; failed mutations are silent. Add
  `MutationCache.onError` toast in `providers.tsx` + a root `error.tsx`.
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
- [ ] **Modal sizing audit** 🟢 — sheets render full-screen on mobile; on
  desktop they should be centered, max-width ~480px, with backdrop (most
  flows use `ModalOrSheet` already — audit stragglers)
- [ ] **19e** 🟢 — convert `ExpenseActionSheet` from floating cards to a Vaul
  bottom sheet (`Sheet` component) for drag-to-dismiss + spring animation
- [ ] **19f** — wire group action menu items (blocked on "Now" step 5)

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

**Skip:** `useGroupDetail`, `useGroupsList`, `useHome` — pure query
composition with no second consumer.

### Later (Phase 2+/3)

- Public expense share page (`/expense/[share_token]`) — skeleton exists,
  needs service-role fetch
- Guest claim flow (`claim_token`, email match, manual link)
- "Former member" display for left members
- Cross-group "Settle all with [person]"
- Receipt scanning / OCR (`/api/ocr`) — Phase 3, feeds `itemized`
- Expense reactions, group leaderboards
- Email notifications, dark-mode toggle surface, PWA/offline
