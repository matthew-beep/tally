# Feature → code map

## Routes (`src/app/`)

| Route | File | Auth | Purpose |
|---|---|---|---|
| `/` | `(dashboard)/page.tsx` | ✓ | Home — balance hero + per-person balances (tap for per-group breakdown) |
| `/groups` | `(dashboard)/groups/page.tsx` | ✓ | Groups list — emoji tile, member `AvatarStack`, and my net in that group (`square ✓` chip when it rounds to zero) |
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

The four tab pages (`/`, `/groups`, `/activity`, `/me`) additionally share
`AppHeader` — title (or Home's hour-based greeting), action button (defaults
to "Add expense", overridable), notification bell. Each page
mounts it itself above its own
`DashboardPage` scroll area rather than the layout owning it, so pages outside
the tab set (group detail, group settings, create group) keep their bespoke
back-button headers. Header CSS is `.app-header*` in `dashboard.css` (renamed
from `.home-topbar*` when the header stopped being Home-only).

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
| `useNotifications` | `useProfile.ts` | Unread notifications with settlement/group joins, grouped by `batch_id` into `NotificationBatch[]` — one entry per payment, not per row. The group join is nested **under the settlement** as well as on the notification row: `notify_settlement_created()` never stamps `notifications.group_id` (only invite rows get one), so for settlement types the settlement's own `group_id` is the only source of a group name/emoji |
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
| `theme.ts`, `../design/tokens.ts` | Design tokens (`T`), fonts (`F`, `FH`, `FMONO`), `well()` recessed-well primitive. Full palette + tactile-depth spec: `docs/design-system.md` |
| `sidebar.ts` | `useSidebarRail()` — toggles `data-sidebar="rail"` on `<html>` + localStorage; CSS owns width (see "Sidebar rail" below) |

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
| `Avatar`, `AvatarStack`, `BalanceBadge` | Design-system atoms — slot-colored avatars, overlapping avatar row (ring per circle, `+N` overflow, `dimmed` for pending members), balance chips |
| `Btn` | Shared CTA button — `primary`/`dark`/`outline`/`danger`/`dangerOutline`/`soft` × `sm`/`md`/`lg`, optional `icon` + `fullWidth`. Every page- and sheet-level CTA goes through it; icon-only circular buttons and unstyled clickable rows/links stay bespoke. Callers pass `style` for one-off *geometry* only — the variant owns fill, depth, and the disabled state. Ten call sites used to re-derive `disabled` in a ternary and hand-roll a sun glow; those were removed 2026-08-19 (they silently overrode the tactile treatment, since `...style` spreads last). `outline` draws an **inset ring**, not a border, so outline/filled pairs in a footer share a box size |
| `Token`, `PersonToken` | The app's one selectable-pill shape (`components/PersonToken.tsx`). `Token` takes optional leading content (avatar/emoji/icon) + label; `PersonToken` wraps it for a group member. Warm-white raised, sun gradient when selected, dips on press. **Renders flat when given no `onClick`** — a pill you can only read is information, not a control. Used by add-expense payer rows (mobile + desktop), the expense sheet's payer picker, category chips, and read-only split chips |
| `Input` | Recessed-well text input (`components/Input.tsx`) — owns the well, the borderless field, `prefix`/`suffix` affixes, and its own focus state (sun rim, replacing the native outline). Sizes `hero` (amount) / `title` (description) / `md` / `cellLg` (desktop split cells) / `cell`. Inputs whose well holds more than a value — `MemberCombobox`'s chips, `HandleInput`'s validation pip — compose `well()` from `design/tokens.ts` directly instead |
| `Segmented` | Recessed track + raised warm-white insert. Backs the desktop add-expense split-mode tabs. Deliberately **not** sun-filled — the sun accent is reserved for the one primary action per view |
| `modal/*` | Modal/sheet primitives — `ModalOrSheet` picks by viewport |
| `home/BalanceSheet`, `home/PersonProfileSheet` | Home balance breakdowns |
| `notifications/NotificationBell` | Icon + actionable-count badge, fed by `useNotifications` + `selectActionable`. Deliberately dumb — the caller owns the sheet (`useNotificationReviewSheet` + `NotificationsSheet`) |
| `dashboard/AppHeader` | Persistent header for the four tab pages. Owns its own bell + `NotificationsSheet` instance, so each mount is independent and callers wire nothing. `action` defaults to "Add expense" (`setFabOpen(true)`, opens the global `ModeSheet` group picker), `hideOnMobile: true` by default since `DockedTabBar`'s center button is the mobile entry point instead — desktop-only in practice unless a page overrides it. All four tab pages use the default. No avatar (dropped 2026-08-15 — redundant with the Me tab on mobile and with `Sidebar`'s own profile card on desktop). Group detail keeps its own bespoke header with a directly-scoped Add Expense button (desktop only — the mobile floating duplicate was removed, see `feature-status.md`) — never goes through `ModeSheet` |
| `dashboard/Sidebar` | Desktop nav — 3 primary destinations (Home/Groups/Activity; `Me` is not a nav item, reached via the profile card instead), inline "+" next to the "Groups" label for group creation, group list, bottom profile card (avatar + name) that opens `ProfileMenuPopover` (identity row → `/me`, theme toggle, sign out) rather than navigating directly. A **floating rounded panel** since 2026-08-19 (inset 12px by `.dashboard-sidebar`, `shadowFloat`), not a flush column. **Collapsible to a 64px rail** — wordmark and the whole group section hide, icons center, toggle is the header. See "Sidebar rail" below. UI-only pass — see `feature-status.md` for what was deliberately left out |
| `TabBar` | Floating-pill mobile nav, 4 destinations incl. `Me`. Currently unmounted — kept for comparison against `DockedTabBar`, swap back into `(dashboard)/layout.tsx` to revert |
| `DockedTabBar` | Docked-bar mobile nav with an elevated center "Add" button (→ `setFabOpen(true)`), currently mounted in `(dashboard)/layout.tsx`. Shares `NAV_TABS`/`pathnameToTab` with `TabBar` via `nav/navTabs.ts`. See `feature-status.md` — this is a live comparison, not a settled choice |

## Sidebar rail (desktop, 2026-08-19)

Collapses the sidebar to 64px: wordmark hidden, the entire "Your groups"
section hidden (label, the "+" and the rows — Groups nav is the way back),
labels collapsed, icons centered, and the collapse toggle becomes the header.
Toggle sits next to the wordmark when expanded; **⌘\\ / Ctrl+\\** works either
way. Desktop only — below 1024px the sidebar is `display: none` and
`DockedTabBar` takes over, so there is no mobile behavior to define.

**The state is CSS-driven on purpose.** `data-sidebar="rail"` on `<html>` is
set *before first paint* by an inline script in `app/layout.tsx` (the same
trick the theme toggle uses), and width/padding live in
`.dashboard-sidebar-panel` in `styles/dashboard.css`. `useSidebarRail()`
(`src/lib/sidebar.ts`) only toggles the attribute and writes localStorage
(`tally-sidebar`) — **React never owns the width**. If the collapsed flag were
read in an effect instead, every page load would paint the sidebar expanded
and snap it narrow on hydration.

Gotchas worth knowing before editing it:

- Inline `display`/`gap`/`padding` on sidebar children beat the rail's CSS.
  `.sidebar-groups` needs its `display: flex` in CSS, not inline, or
  `display: none` loses; nav items need `gap: 0` in the rail or the zero-width
  label still reserves space and the icon sits left of centre.
- The active-nav pill re-measures for free — `useSlider` already observes its
  container with a `ResizeObserver`, so it tracks the width animation.
- Preference persists across sessions; `prefers-reduced-motion` drops the
  transitions.

## Not built yet (referenced but pending)

- **Itemized splits** — `expense_items` / `expense_item_assignments` tables
  exist in the baseline schema; client save path and builders are not wired
  (desktop/mobile show "Coming soon"). Gateway to Phase 3 receipt scanning.
- **Expense history viewer** — snapshots captured in `expense_history` on every
  edit, zero UI to read them
- **Public expense share page** (`/expense/[share_token]`) — route exists;
  service-role fetch joins are stale vs current schema (likely broken — see
  `TODO.md` Later)
- **Tab bar nav badges** — `TabBar.tsx`'s `NAV_BADGES` is still a hardcoded
  empty object; `Sidebar.tsx` has no badge slot. The header bell + 30s poll on
  `useNotifications` (`refetchInterval: 30_000`) shipped 2026-08-16.
