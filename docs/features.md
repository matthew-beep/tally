# Feature → code map

## Routes (`src/app/`)

| Route | File | Auth | Purpose |
|---|---|---|---|
| `/` | `(dashboard)/page.tsx` | ✓ | Home — balance hero + per-person balances (tap for per-group breakdown) |
| `/groups` | `(dashboard)/groups/page.tsx` | ✓ | Groups list |
| `/groups/new` | `(dashboard)/groups/new/page.tsx` | ✓ | Create group |
| `/groups/[id]` | `(dashboard)/groups/[id]/page.tsx` | ✓ | Group detail — balances, members, expense/settlement feed, action sheets |
| `/groups/[id]/add` | `(dashboard)/groups/[id]/add/page.tsx` | ✓ | Add expense (full-page variant) |
| `/activity` | `(dashboard)/activity/page.tsx` | ✓ | Cross-group activity feed |
| `/me` | `(dashboard)/me/page.tsx` | ✓ | Profile, pending invites, settlement confirmations |
| `/login` | `login/page.tsx` | public | Google OAuth + dev login |
| `/onboarding` | `onboarding/page.tsx` | ✓ | Pick @handle (forced while handle is NULL) |
| `/auth/callback` | `auth/callback/route.ts` | public | OAuth code exchange |
| `/invite/[token]` | `invite/[token]/page.tsx` | public→login | Join group by link (immediate active). Group-by-token lookup is `get_group_by_invite_token()`, a `SECURITY DEFINER` RPC — a direct table query only works for visitors RLS already recognizes as members/creator/pending, excluding the cold-invite case the link exists for |
| `/add/[add_code]` | `add/[add_code]/page.tsx` | ✓ | QR destination — add person to a group |
| `/claim/[token]` | `claim/[token]/page.tsx` | public→login | Claim a guest seat by link — self-serve counterpart to search-based linking below |
| `/expense/[share_token]` | `expense/[share_token]/page.tsx` | public | Skeleton only — service-role fetch not wired |

The `(dashboard)` route group shares `(dashboard)/layout.tsx`: sidebar ≥1024px,
tab bar below (breakpoint in `src/styles/dashboard.css`).

## API routes (`src/app/api/`)

| Endpoint | Purpose |
|---|---|
| `POST /api/groups/create` | Insert group + creator (active) + invitees (pending) + guests (active, `user_id NULL`) |
| `POST /api/groups/members/add` | Same member semantics for an existing group |
| `POST /api/invite/decline` | Decline invite: no history → delete row; in splits already → convert seat to guest (see flows.md) |
| `POST /api/groups/members/claim-invite` | Assisted guest claim (Path B) — attaches a searched profile to a guest seat as `pending`, requiring their accept; service-role, resolves the target's name server-side, never trusts the client for it |
| `POST /api/ocr` | Phase 3 receipt-OCR proxy — stub |

## Query hooks (`src/queries/`)

| Hook | File | What it does |
|---|---|---|
| `useCurrentProfile`, `useUpdateProfile` | `useProfile.ts` | Own profile read/update (display_name, handle) |
| `useSearchProfiles` | `useProfile.ts` | 3-mode member search (@handle / add_code / fuzzy) |
| `useProfileByAddCode` | `useProfile.ts` | QR add-code lookup |
| `useNotifications` | `useProfile.ts` | Unread notifications with settlement/group joins, grouped by `batch_id` into `NotificationBatch[]` — one entry per payment, not per row |
| `useGroups`, `useGroup` | `useGroups.ts` | My groups (active memberships only), single group. `groupsQueryOptions` is the root of the cross-group dependency tree |
| `useMyGroupIds` | `useMyGroupIds.ts` | Ids view over the `['groups']` cache via `select` — not a query of its own |
| `useAllGroupData` | `useAllGroupData.ts` | `useQueries` fan-out: expenses/settlements/members per group, sharing the single-group hooks' cache keys |
| `useGroupMembers` | `useGroups.ts` | Members incl. pending (splittable before accept) |
| `useCreateGroup`, `useDeleteGroup` | `useGroups.ts` | Create (via API route), hard delete |
| `useAcceptGroupInvite`, `useDeclineGroupInvite` | `useMembers.ts` | Pending → active / POST `/api/invite/decline` (delete or guest conversion) |
| `useRecentCollaborators` | `useMembers.ts` | Recents for the member combobox |
| `useInviteGuestToSeat` | `useGroups.ts` | POST `/api/groups/members/claim-invite` — Path B assisted guest claim |
| `useExpenses` | `useExpenses.ts` | Group expenses + splits + payer (soft-deleted excluded) |
| `useAddExpense` | `useExpenses.ts` | Insert expense + splits |
| `useUpdateExpense` | `useExpenses.ts` | Edit desc/amount/payer; rescales splits proportionally |
| `useDeleteExpense` | `useExpenses.ts` | Soft delete (`deleted_at`) |
| `useSettlements` | `useSettlements.ts` | Group settlements |
| `useCreateSettlements` | `useSettlements.ts` | **Plural, group-unbound.** One payment → N rows sharing a `batch_id` and one status, written in a single atomic insert. A one-group settle is a batch of one; there is no singular variant |
| `useConfirmSettlement`, `useDenySettlement` | `useSettlements.ts` | Confirm / deny (delete) — act on every row in the batch (`.in('id', ids)`), never a slice of a payment |
| `useGlobalBalances` | `useGlobalBalances.ts` | **Derivation, no query of its own** — folds the per-group caches into cross-group nets, per-person pairwise, hero grosses |
| `useAllActivity` | `useActivity.ts` | **Derivation** — `mergeFeed` per group, shaped + bucketed by group |

Mutations invalidate only the per-group keys they touch (`['expenses', gid]`
etc.); the cross-group hooks are pure folds over those caches, so they
recompute without their own invalidation. Full model in
[data-loading-architecture.md](./data-loading-architecture.md). Balances are
never cached in the DB — recomputation happens on read.

## Domain libs (`src/lib/`)

| File | Purpose |
|---|---|
| `balance.ts` | `calcNetBalances` (net per member), `calcPairwiseNets` (them-vs-me map), `summarizeBalances` (hero fold), `calcExpenseNets` (one expense's effect per participant — detail sheet only, not a balance) — all pure, tested incl. pairwise↔net invariant. No min-transfer simplification (`simplifyDebts`, deleted 2026-08-02) — settling up always uses pairwise nets |
| `leaderboard.ts` | `calcLeaderboard` — gross fronted per member, ranked. Not a balance: settlements never subtract from it |
| `feed.ts` | `mergeFeed` — expenses + settlements → one `created_at`-sorted tagged timeline |
| `settlements.ts` | `batchNet` / `batchStatus` / `buildSettlementBatch` — turns allocations into insert-ready rows. Owns the rule that a batch's confirmation status comes from the sign of its net, once per payment rather than per row |
| `notifications.ts` | `groupNotifications` — collapses a recipient's rows into one `NotificationBatch` per payment, plus the id helpers confirm/deny and cache invalidation read from |
| `api.ts` | `postJson` — the one way to call internal API routes; always throws the server's `{ error }` |
| `splits.ts` | `makeEqualSplits` / `makePercentSplits` / `makeExactSplits` / `rescaleSplits` — rounding remainder to first row |
| `categories.ts` | 7 emoji categories, keyword auto-detect from description |
| `memberDisplay.ts` | `displayName` / `avatarProfile` — profile fallback chain for members & guests |
| `clipboard.ts` | `copyToClipboard` — `navigator.clipboard` with an `execCommand` fallback; shared by the invite-link and claim-link copy buttons |
| `supabase.ts` / `supabase-server.ts` | Browser client / server + service-role clients |
| `theme.ts`, `../design/tokens.ts` | Design tokens (`T`), fonts (`F`, `FH`, `FMONO`) |

## Key components (`src/components/`)

| Component | Purpose |
|---|---|
| `AddExpenseForm` / `AddExpenseSheet` | Add-expense form, mobile sheet + desktop modal branches |
| `ExpenseActionSheet` | Expense tap → detail (per-person nets, edit/delete footer) / edit drawer / delete confirm |
| `GroupLeaderboard` | Collapsible "who fronted the most" bars on the group page |
| `MemberCombobox`, `SuggestedMembers` | Member search input + recents |
| `MemberActionSheet` | Member tap → remove (real members) or, for a guest row, a two-path claim flow: search + confirmation-required invite (Path B), or a self-serve claim-link screen (Path A) |
| `InviteGroupSheet` | Group settings "Invite to group" — link card, copy, `navigator.share` |
| `DeleteGroupSheet` | Delete-group confirmation (opened from group settings' danger zone) |
| `Avatar`, `BalanceBadge` | Design-system atoms (slot-colored avatars, balance chips) |
| `modal/*` | Modal/sheet primitives — `ModalOrSheet` picks by viewport |
| `home/BalanceSheet`, `home/PersonProfileSheet` | Home balance breakdowns |
| `dashboard/Sidebar`, `TabBar` | Desktop / mobile navigation |

## Not built yet (referenced but pending)

- Itemized splits (`expense_items` tables + UI) — placeholder in the form
- Expense history viewer (snapshots captured in `expense_history`, no UI)
- Public expense share page (`/expense/[share_token]` skeleton)
- Notifications bell 30s poll (list exists on Me page; no polling badge)
