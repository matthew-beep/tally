# Code review checklist — file-by-file reading order

A reading order for a full manual review of the codebase (~12,500 lines),
foundation-up: each phase builds the vocabulary needed to read the next one
faster, and the highest bug-density territory (schema, queries, API routes)
comes first. Line counts from 2026-07-13.

Check files off as you go. Findings go to `TODO.md` — this document is only
the map. The **Appendix** lists issues already logged, so you don't burn
time re-discovering them.

---

## Phase 1 — Schema & domain foundation (~1,300 lines)

Read `docs/schema.md` alongside. This phase defines every term the rest of
the codebase uses.

- [ ] `supabase/migrations/20260526000000_handle_member_status.sql` (201) —
  first tracked migration; note what it *assumes* already exists (the
  untracked baseline schema)
- [ ] `supabase/migrations/20260617000000_create_group_with_members.sql` (47)
  — historical only: the RPC was dead + broken, dropped by
  `20260713000000_drop_stale_group_rpc.sql`
- [ ] `supabase/migrations/20260621000000_group_member_model.sql` (248) —
  the big one: surrogate PK, split remapping, cascade behavior, trigger
  rewrites, partial unique index
- [ ] `supabase/migrations/20260705000000_fix_expense_update_rls.sql` (19) —
  understand what the original policy got wrong
- [ ] `supabase/migrations/20260705230000_fix_expense_select_rls.sql` (23) —
  same
- [ ] `supabase/migrations/20260711000000_decline_to_guest.sql` (27) —
  trigger guard: accepted requires `user_id NOT NULL`; declined-via-
  conversion branch
- [ ] `src/types/index.ts` (140) — drift vs. actual schema (the Notification
  union already drifted once)
- [ ] `src/lib/supabase.ts` (15) — `getAuthUser` uses `getSession`;
  client-side OK, but know it
- [ ] `src/lib/supabase-server.ts` (31) — service-role client; `require()`
  import; no `server-only` guard yet
- [ ] `src/lib/balance.ts` (61) + `src/lib/balance.test.ts` (159) — read
  tests as the spec; confirm they match your intent for the invariants
- [ ] `src/lib/splits.ts` (68) + `src/lib/splits.test.ts` (154) — same;
  remainder-to-first-row vs remainder-to-payer contracts
- [ ] `src/lib/rateLimit.ts` (78) — fail-open decision and documented slop —
  agree or tighten
- [ ] `src/lib/categories.ts` (19) — trivial
- [ ] `src/lib/memberDisplay.ts` (18) — the display-name fallback chain used
  everywhere
- [ ] `src/lib/theme.ts` (27) + `src/design/tokens.ts` (53) — skim

**Phase-1 exit question:** for every table, do you know whether RLS is on
and what the policy says? The repo only shows policies for
expenses/settlements/expense_history — the rest lives in the Supabase
dashboard. Check there; it's the highest-risk unknown in the app.

## Phase 2 — Trust boundary (~1,200 lines) ← highest value per line

- [ ] `src/proxy.ts` (73) — the auth guard; uses `getUser()` correctly.
  Check the public-path list and onboarding redirect
- [ ] `src/app/auth/callback/route.ts` (16) — OAuth code exchange; redirect
  handling
- [ ] `src/app/api/groups/create/route.ts` (58) — privileged member inserts
  for other users; rate limit; note: no rollback if the member insert fails
  after the group insert
- [ ] `src/app/api/groups/members/add/route.ts` (64) — upsert semantics:
  can it demote an *active* member back to pending? `onConflict` correctness
- [ ] `src/app/api/invite/decline/route.ts` (64) — history check → delete
  vs guest conversion; service-role scope
- [ ] `src/app/api/ocr/route.ts` (5) — stub, skim
- [ ] `src/queries/useProfile.ts` (136) — search modes;
  `useMarkNotificationsRead`'s deliberate no-invalidate choice
- [ ] `src/queries/useGroups.ts` (123) — status filters (`pending`+`active`
  on purpose in `useGroupMembers`); hard group delete
- [ ] `src/queries/useMembers.ts` — accept/decline paths, recents
- [ ] `src/queries/useExpenses.ts` (149) — update = delete/re-insert splits,
  non-atomic: what happens on partial failure?
- [ ] `src/queries/useSettlements.ts` (83) — deny = DELETE; pending counts
  toward balance
- [ ] `src/queries/useActivity.ts` (93) — merge + sort logic
- [ ] `src/queries/useGlobalBalances.ts` (292) — the beast: reimplements
  balance math instead of using `lib/balance.ts` — verify the two agree;
  `effectiveId` guest handling

Note for the whole queries layer: no `onError` anywhere (logged in TODO),
and every RLS assumption in the app is exercised here.

## Phase 3 — Entry & auth-adjacent pages (~1,200 lines)

- [ ] `src/app/login/page.tsx` (142) + `src/app/login/LoginButton.tsx` (169)
  — dev-login gating (`NEXT_PUBLIC_DEV_*` must not affect prod);
  `?redirect` preservation through OAuth
- [ ] `src/app/onboarding/page.tsx` (156) — handle write path: lowercase
  enforcement before write
- [ ] `src/components/HandleInput.tsx` (218) — availability check: race
  conditions, lowercase, reserved handles?
- [ ] `src/app/invite/[token]/page.tsx` (215) — token → auto-join: status
  set correctly? re-join after leaving? already-a-member case?
- [ ] `src/app/add/[add_code]/page.tsx` (223) — QR destination: profile
  lookup, group picker
- [ ] `src/app/expense/[share_token]/page.tsx` (60) — known skeleton; skim
  and confirm it leaks nothing while unfinished

## Phase 4 — Core UI: the money screens (~3,300 lines)

Ordered by flow, not file size. The question here is "does the UI respect
the invariants" — deleted-expense filtering, status filters, rounding
display.

**Expense flow**

- [ ] `src/components/AddExpenseForm.tsx` (1202) — biggest file in the repo.
  Split-mode state machine, payer-remainder logic, itemized placeholder must
  not save; candidate for the `useAddExpense` extraction
- [ ] `src/components/ExpenseActionSheet.tsx` (417) — edit rescale path,
  delete confirm; desktop presentation is the mobile cards (known)
- [ ] `src/app/(dashboard)/groups/[id]/add/page.tsx` (16) — wrapper, skim

**Group detail & membership**

- [ ] `src/app/(dashboard)/groups/[id]/page.tsx` (618) — pairwise-net math
  duplicated inline (a third implementation of balance logic); mobile and
  desktop copies of the add-member JSX; feed grouping
- [ ] `src/components/MemberCombobox.tsx` (223) — the LIVE add-member path;
  guest entry; exclude logic
- [ ] `src/components/GroupActionMenu.tsx` (133) — menu items with no flows
  behind them yet
- [ ] `src/components/DeleteGroupSheet.tsx` (163) — hard delete: should it
  require zero balances?

**Create & settle**

- [ ] `src/app/(dashboard)/groups/new/page.tsx` (826) — second-biggest file;
  the single group-create path
- [ ] `src/components/SuggestedMembers.tsx` (165) — recents source
- [ ] `src/app/(dashboard)/groups/[id]/settle/page.tsx` (242) — pre-fill
  from `simplifyDebts`; partial amounts; self-settle prevention

## Phase 5 — Dashboard shell & remaining screens (~1,900 lines)

- [ ] `src/app/layout.tsx` (46) + `src/app/providers.tsx` (25) +
  `src/app/(dashboard)/layout.tsx` (28) — provider setup, theme-flash
  script, where GlobalDataPrefetch will mount
- [ ] `src/app/(dashboard)/page.tsx` (358) — home: hero math from
  `useGlobalBalances`
- [ ] `src/components/home/BalanceSheet.tsx` (171) +
  `src/components/home/PersonProfileSheet.tsx` (127) +
  `src/components/HomeScreenSkeleton.tsx` (120) — cross-group breakdown
  display
- [ ] `src/app/(dashboard)/me/page.tsx` (347) — notification sections,
  including the new info-row/auto-mark-read logic
- [ ] `src/app/(dashboard)/activity/page.tsx` (48) +
  `src/components/ActivityRow.tsx` (55) — "(edited)" tag logic
- [ ] `src/app/(dashboard)/groups/page.tsx` (85) — list + per-group balance
  chips
- [ ] `src/components/dashboard/Sidebar.tsx` (220) +
  `src/components/dashboard/DashboardPage.tsx` (12) — no badge slot yet
  (bell badge pending)
- [ ] `src/components/TabBar.tsx` (119) + `src/components/nav/*` (~225) —
  `NAV_BADGES` hardcoded empty; slider mechanics
- [ ] `src/components/ModeSheet.tsx` (113) + `src/store/ui.ts` (21) +
  `src/hooks/useMediaQuery.ts` (24) + `src/hooks/useDebouncedValue.ts` (14)
  — Zustand scope stays UI-only

## Phase 6 — Modal system, atoms, CSS (~1,400 lines)

- [ ] `src/components/modal/*` (11 files, ~610) — one system or three?
  `ActionSheet` (235) vs `Modal` vs `Sheet` vs `ModalOrSheet`; which
  components bypass the system entirely (known: several)
- [ ] `src/components/Avatar.tsx` (58), `BalanceBadge.tsx` (51),
  `Btn.tsx` (52), `Card.tsx` (30) — design-system atoms; amount anatomy
  (always-signed, U+2212 minus) is currently inline `toFixed(2)` everywhere
- [ ] `src/app/globals.css` (471) + `src/styles/dashboard.css` (285) —
  breakpoint consistency (1024 vs 767), dark-mode variable coverage

---

## Appendix — known issues already logged (don't re-discover)

- RLS state of core tables unknowable from the repo — TODO → Prod readiness
- API routes use `getSession()` instead of `getUser()` — TODO
- Zero `onError` handling / error boundaries app-wide — TODO
- Dead code purged 2026-07-13 (`AddMemberModal`, `NewGroupModal`,
  `BalanceBreakdownModal`, `AmountDisplay`, `AppShell`, `useAddGroupMember`,
  stale group RPC) — recoverable from git if ever needed
- Bell badge unfed; `GlobalDataPrefetch` not built — TODO step 4
- `/expense/[share_token]` is a skeleton; itemized split UI is non-saving;
  group settings don't exist — `docs/feature-status.md`
- Desktop columns in `docs/feature-status.md` intentionally blanked pending
  manual verification — fill them in as you review
