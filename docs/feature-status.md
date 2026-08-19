# Feature status — mobile + desktop

Snapshot from a 2026-07-12 codebase audit, updated through 2026-08-19 for
cross-group settlement, tactile design pass, and sidebar rail. "Done" means
working end-to-end today, on that form factor. This is a point-in-time review
document, not a task list — see `TODO.md` for actionable next steps and
priority order.

## Core features


| Feature                                        | Backend | Mobile | Desktop | What's missing                                                                               |
| ---------------------------------------------- | ------- | ------ | ------- | -------------------------------------------------------------------------------------------- |
| Auth + onboarding (Google, @handle)            | ✅       | ✅      | ✅       | —                                                                                            |
| Group create / list                            | ✅       | ✅      | ✅       | —                                                                                            |
| Group detail (feed, balances, members)         | ✅       | ✅      | ✅ 2-col | Avatar tap → person sheet on group page still blocked on global data prefetch                 |
| Add members (search, invite link, QR, guests)  | ✅       | ✅      | ✅       | Cancel pending invite; invite-link regenerate                                                |
| Invite accept / decline → guest conversion     | ✅       | ✅      | ✅       | —                                                                                            |
| Add expense (equal / exact / percentage)       | ✅       | ✅      | ✅       | Desktop panel rework landed 2026-08-19 (`Input`, `Segmented`, `PersonToken`); itemized tab still "Coming soon"; mobile has no date picker |
| Edit / delete expense (audited, soft delete)   | ✅       | ✅      | ✅       | Split editing, category/date editing, edit-history viewer, optional note field               |
| Balances + per-person breakdown                | ✅       | ✅      | ⚠️      | Home balance-card expand + per-group settle drill-down shipped; home 3-column desktop layout still open |
| Settle up + confirm / deny                     | ✅       | ✅      | ✅       | Cross-group settle-all + per-group drill-down shipped in `BalanceSheet`; delete-settlement UI still missing |
| Activity feed (global tab)                     | ✅       | ✅      | ✅       | Batch settlement rows still render as N separate feed items (see `TODO.md` punch list §5 phase 3) |
| Notifications (bell in app header + Me page)   | ✅       | ✅      | ✅       | 30s poll on `useNotifications` shipped 2026-08-16; batch settlement card layout still single-settlement shape; `TabBar` `NAV_BADGES` unfed |
| Profile / Me (display name, handle, QR, theme) | ✅       | ✅      | ✅       | —                                                                                            |
| Group settings (rename, members, leave, delete)| ✅       | ✅      | ⚠️      | Invite link show/copy/share shipped (`InviteGroupSheet`); regenerate + cancel-pending-invite missing; desktop is still the mobile 520px card |
| Guest claim (self-serve link + assisted invite)| ✅       | ✅      | ✅       | —                                                                                            |


**The through-line:** the mobile core loop is complete — sign up, split, and
settle entirely on phones today, including cross-group settlement from home.
Desktop is functional everywhere; every sheet/modal renders through
`ModalOrSheet`. The bigger *designed* treatments still open: home's
3-column dashboard and group settings' desktop layout. The sidebar got two
passes — nav trim 2026-08-13, floating panel + collapsible rail 2026-08-19
(see below).

## Core features not yet developed at all

1. **Itemized splits — client only.** `expense_items` /
   `expense_item_assignments` tables exist in the baseline schema; desktop and
   mobile builders show "Coming soon" and nothing reaches `handleSave`. Gateway
   to Phase 3 receipt scanning.
2. **Public expense share page** (`/expense/[share_token]`) — route + skeleton
   exist; service-role fetch joins don't match the current schema (likely
   broken — every share link renders invalid).
3. **Edit-history viewer** — data captured in `expense_history` on every edit,
   zero UI to read it.
4. **App-level global data prefetch** — `useGlobalBalances` only runs on home;
   deep-linked pages lack cross-group balance data for avatar taps on group
   detail (see `TODO.md` Now §4).
5. **Sidebar balance signals** — deliberately skipped in the 2026-08-13
   sidebar redesign, not forgotten:
   - Per-group balance dot in the sidebar group list.
   - Net balance line in the bottom profile card.
   Wiring either upgrades the sidebar from a cheap `['groups']` query to
   `useGlobalBalances()`'s full N-group fan-out on every route.

## Shipped since last major update (2026-07-26)

**Cross-group settlement shipped 2026-08-16** (`BalanceSheet.tsx`,
`useCreateSettlements`, `batch_id` model): home's "Settle up with [person]"
writes N group-scoped rows in one batch; per-group row tap drills into
`GroupSettleScreen` with editable amount and Full/Half/Clear chips. Settle-all
confirm screen shows gross per direction plus net transfer. Delete-settlement
and batch-grouping in the activity feed are still open (`TODO.md` punch list §5
phase 3).

**Balance breakdown + per-group settle shipped 2026-08-16 / 2026-08-18**
(`PersonProfileSheet`, `BalanceSheet`): avatar/row taps on home show full
per-person, per-group breakdown. `GroupBreakdown` rows tap into single-group
settle (2026-08-18 UI pass).

**Notification bell + 30s poll shipped 2026-08-12 / 2026-08-16**
(`AppHeader`, `NotificationBell`, `useNotifications`): actionable count on all
four tab pages + group-detail header; `refetchInterval: 30_000` per
`CLAUDE.md`. Batch settlement card copy/layout still deferred to notification
center work.

**Invite link UI partially shipped 2026-08-16** (`InviteGroupSheet` in group
settings): show, copy, native share. Regenerate token still missing.

**Tactile depth design pass shipped 2026-08-19** (`docs/design-system.md` §
Tactile depth): four-tier shadow system (flat / recessed / raised / floating),
shared primitives `Btn`, `Input`, `Segmented`, `Token`/`PersonToken`, `well()`
in `design/tokens.ts`. Desktop add-expense panel rebuilt on these primitives.
`T.shadowFab` deleted — FAB and active nav pill use sun gradient +
`--tally-shadow-sun`. Open decision: flatten read-only `Card` surfaces (see
design-system doc).

**Sidebar rail shipped 2026-08-19** (`Sidebar.tsx`, `lib/sidebar.ts`,
`dashboard.css`): desktop sidebar is a floating rounded panel (inset 12px,
`shadowFloat`), user-collapsible to a 64px icon rail (⌘\\ / Ctrl+\\,
localStorage, pre-paint via `data-sidebar` on `<html>`). See `features.md` →
"Sidebar rail".

**UI polish shipped 2026-08-18 / 2026-08-19** (see `TODO.md` UI/design pass):
global thin scrollbars + number-input spinner removal; mobile nav safe-area
background fix; scroll utilities (`.tally-scroll-hidden`).

**App shell + button system shipped 2026-08-12** (`docs/features.md` § Key
components): four tab pages share `AppHeader`; `Btn` adopted app-wide (tactile
treatment 2026-08-19); `AvatarStack` extracted; groups list rebuilt on emoji
tile + avatar stack + signed amount.

**`AppHeader`'s avatar removed 2026-08-15.** Redundant with Me tab (mobile)
and sidebar profile card (desktop). Sidebar profile card opens
`ProfileMenuPopover` (identity → `/me`, theme toggle, sign out).

**Sidebar nav trim shipped 2026-08-13:** 3 destinations (Home/Groups/Activity);
Me via bottom profile card; inline "+" for group creation.

**Global "Add expense" shipped 2026-08-13** (`AppHeader` + `DockedTabBar`):
desktop header button and mobile center FAB → `AddExpenseGroupPicker`. Still
open: `activeGroupId` never set — FAB on group detail doesn't skip the picker
(`TODO.md` UI pass).

**Mobile nav — docked bar live, floating pill kept for A/B** (`DockedTabBar.tsx`
mounted; `TabBar.tsx` unmounted but preserved). Decision not made.

**Guest claim flow shipped 2026-08-11** (`/claim/[token]`, claim-invite API).

**Group settings shipped 2026-07** (rename, members, leave, delete). Gaps:
cancel pending invite; invite-link regenerate.

## What specifically needs desktop design work

- **Home dashboard 3-column layout** — design reference `home-overview.jsx`;
  `RecentGroups` component written but never rendered on home.
- **Group settings** — still the mobile 520px centered card at all widths.
- **Itemized split builder** — desktop panel shell exists; save path not wired.
- **Flat vs elevated info cards** — tactile guide decision pending
  (`docs/design-system.md` § Open decision).

## Rough impact ranking

Itemized splits (client-side) and the public share page (broken fetch) are the
two biggest genuinely-missing pieces. Group settings' remaining gaps
(cancel-pending-invite, regenerate invite link) are smaller follow-ups. Home
3-column layout and the UI/design pass backlog (`TODO.md` 2026-08-18 section)
are the main polish work before ship.
