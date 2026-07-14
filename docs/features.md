# Feature → code map

## Routes (`src/app/`)

| Route | File | Auth | Purpose |
|---|---|---|---|
| `/` | `(dashboard)/page.tsx` | ✓ | Home — balance hero, groups panel, recent activity, people you owe / owe you |
| `/groups` | `(dashboard)/groups/page.tsx` | ✓ | Groups list |
| `/groups/new` | `(dashboard)/groups/new/page.tsx` | ✓ | Create group |
| `/groups/[id]` | `(dashboard)/groups/[id]/page.tsx` | ✓ | Group detail — balances, members, expense/settlement feed, action sheets |
| `/groups/[id]/add` | `(dashboard)/groups/[id]/add/page.tsx` | ✓ | Add expense (full-page variant) |
| `/groups/[id]/settle` | `(dashboard)/groups/[id]/settle/page.tsx` | ✓ | Settle up |
| `/activity` | `(dashboard)/activity/page.tsx` | ✓ | Cross-group activity feed |
| `/me` | `(dashboard)/me/page.tsx` | ✓ | Profile, pending invites, settlement confirmations |
| `/login` | `login/page.tsx` | public | Google OAuth + dev login |
| `/onboarding` | `onboarding/page.tsx` | ✓ | Pick @handle (forced while handle is NULL) |
| `/auth/callback` | `auth/callback/route.ts` | public | OAuth code exchange |
| `/invite/[token]` | `invite/[token]/page.tsx` | public→login | Join group by link (immediate active) |
| `/add/[add_code]` | `add/[add_code]/page.tsx` | ✓ | QR destination — add person to a group |
| `/expense/[share_token]` | `expense/[share_token]/page.tsx` | public | Skeleton only — service-role fetch not wired |

The `(dashboard)` route group shares `(dashboard)/layout.tsx`: sidebar ≥1024px,
tab bar below (breakpoint in `src/styles/dashboard.css`).

## API routes (`src/app/api/`)

| Endpoint | Purpose |
|---|---|
| `POST /api/groups/create` | Insert group + creator (active) + invitees (pending) + guests (active, `user_id NULL`) |
| `POST /api/groups/members/add` | Same member semantics for an existing group |
| `POST /api/invite/decline` | Decline invite: no history → delete row; in splits already → convert seat to guest (see flows.md) |
| `POST /api/ocr` | Phase 3 receipt-OCR proxy — stub |

## Query hooks (`src/queries/`)

| Hook | File | What it does |
|---|---|---|
| `useCurrentProfile`, `useUpdateProfile` | `useProfile.ts` | Own profile read/update (display_name, handle) |
| `useSearchProfiles` | `useProfile.ts` | 3-mode member search (@handle / add_code / fuzzy) |
| `useProfileByAddCode` | `useProfile.ts` | QR add-code lookup |
| `useNotifications` | `useProfile.ts` | Unread notifications with settlement/group joins |
| `useGroups`, `useGroup` | `useGroups.ts` | My groups (active memberships only), single group |
| `useGroupMembers` | `useGroups.ts` | Members incl. pending (splittable before accept) |
| `useCreateGroup`, `useDeleteGroup` | `useGroups.ts` | Create (via API route), hard delete |
| `useAcceptGroupInvite`, `useDeclineGroupInvite` | `useMembers.ts` | Pending → active / POST `/api/invite/decline` (delete or guest conversion) |
| `useRecentCollaborators` | `useMembers.ts` | Recents for the member combobox |
| `useExpenses` | `useExpenses.ts` | Group expenses + splits + payer (soft-deleted excluded) |
| `useAddExpense` | `useExpenses.ts` | Insert expense + splits |
| `useUpdateExpense` | `useExpenses.ts` | Edit desc/amount/payer; rescales splits proportionally |
| `useDeleteExpense` | `useExpenses.ts` | Soft delete (`deleted_at`) |
| `useSettlements`, `useCreateSettlement` | `useSettlements.ts` | Group settlements; record as pending |
| `useConfirmSettlement`, `useDenySettlement` | `useSettlements.ts` | Confirm / deny (delete) |
| `useGlobalBalances` | `useGlobalBalances.ts` | Cross-group nets, gross owed/owing per person |
| `useRecentActivity` | `useGlobalBalances.ts` | Home feed (last expenses across groups) |
| `useAllActivity` | `useActivity.ts` | Activity tab (expenses + settlements merged) |

Mutation hooks invalidate every aggregate they affect (`global-balances`,
`recent-activity`, `all-activity`, plus the group-scoped keys). Balances are
never cached in the DB — recomputation happens on read.

## Domain libs (`src/lib/`)

| File | Purpose |
|---|---|
| `balance.ts` | `calcNetBalances` (net per member) + `simplifyDebts` (greedy min-transfer) |
| `splits.ts` | `makeEqualSplits` / `makePercentSplits` / `makeExactSplits` — rounding remainder to first row |
| `categories.ts` | 7 emoji categories, keyword auto-detect from description |
| `memberDisplay.ts` | `displayName` / `avatarProfile` — profile fallback chain for members & guests |
| `supabase.ts` / `supabase-server.ts` | Browser client / server + service-role clients |
| `theme.ts`, `../design/tokens.ts` | Design tokens (`T`), fonts (`F`, `FH`, `FMONO`) |

## Key components (`src/components/`)

| Component | Purpose |
|---|---|
| `AddExpenseForm` / `AddExpenseSheet` | Add-expense form, mobile sheet + desktop modal branches |
| `ExpenseActionSheet` | Expense tap → actions / edit drawer / delete confirm |
| `MemberCombobox`, `SuggestedMembers` | Member search input + recents |
| `GroupActionMenu`, `DeleteGroupSheet` | Group ··· menu, delete confirmation |
| `Avatar`, `BalanceBadge` | Design-system atoms (slot-colored avatars, balance chips) |
| `modal/*` | Modal/sheet primitives — `ModalOrSheet` picks by viewport |
| `home/BalanceSheet`, `home/PersonProfileSheet` | Home balance breakdowns |
| `dashboard/Sidebar`, `TabBar` | Desktop / mobile navigation |

## Not built yet (referenced but pending)

- Itemized splits (`expense_items` tables + UI) — placeholder in the form
- Expense history viewer (snapshots captured in `expense_history`, no UI)
- Public expense share page (`/expense/[share_token]` skeleton)
- Group settings page (`/groups/[id]/settings`), leave group
- Guest claim flow (`claim_token`)
- Notifications bell 30s poll (list exists on Me page; no polling badge)
