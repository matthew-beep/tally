# Feature status — mobile + desktop

Snapshot from a 2026-07-12 codebase audit, updated 2026-07-26 for group
settings. "Done" means working end-to-end today, on that form factor. This
is a point-in-time review document, not a task list — see `TODO.md` for
actionable next steps and priority order.

## Core features


| Feature                                        | Backend | Mobile | Desktop | What's missing                                                                               |
| ---------------------------------------------- | ------- | ------ | ------- | -------------------------------------------------------------------------------------------- |
| Auth + onboarding (Google, @handle)            | ✅       | ✅      | ✅       | —                                                                                            |
| Group create / list                            | ✅       | ✅      | ✅       | —                                                                                            |
| Group detail (feed, balances, members)         | ✅       | ✅      | ✅ 2-col | Avatar tap → person sheet (blocked on global data prefetch)                                  |
| Add members (search, invite link, QR, guests)  | ✅       |        |         | —                                                                                            |
| Invite accept / decline → guest conversion     | ✅       |        |         | —                                                                                            |
| Add expense (equal / exact / percentage)       | ✅       | ✅      |         | —                                                                                            |
| Edit / delete expense (audited, soft delete)   | ✅       | ✅      | ✅       | §19e done 2026-07-26 — real centered-modal desktop presentation via `ModalOrSheet`; split editing and an edit-history viewer are still missing on both form factors |
| Balances + debt simplification                 | ✅       | ✅      | ⚠️      | Home is single-column on desktop — 3-col dashboard not built; balance-card expand modal      |
| Settle up + confirm / deny                     | ✅       |        |         | Cross-group "settle all with person"                                                         |
| Activity feed (global tab)                     | ✅       |        |         | Works, but it's a bare 48-line list — no desktop enrichment                                  |
| Notifications (bell in app header + Me page)   | ✅       | ✅      | ✅       | Bell + count badge shipped 2026-08-12 in `AppHeader`; still no 30s poll, and `TabBar`'s `NAV_BADGES` is unfed |
| Profile / Me (display name, handle, QR, theme) | ✅       | ✅      |         | —                                                                                            |
| Group settings (rename, members, leave, delete)| ✅       | ✅      | ⚠️      | Pending invites render read-only with no cancel action; desktop is the mobile 520px-centered card layout, not a designed 2-col treatment |
| Guest claim (self-serve link + assisted invite)| ✅       |        |         | —                                                                                            |


**The through-line:** the mobile core loop is complete — a group of people
can sign up, split, and settle entirely on phones today. Desktop is
functional everywhere, and as of 2026-07-26 every sheet/modal in the app
renders through the shared `ModalOrSheet` primitive (centered modal on
desktop, not the mobile layout stretched wide). The bigger *designed*
(not just "the mobile layout at a wider viewport") treatments remain
narrower: group detail's 2-column layout. Home's 3-column dashboard and
group settings' desktop layout are still open. The sidebar nav got a
designed pass 2026-08-13 (see below) but stayed UI-only.

## Core features not yet developed at all

1. **Itemized splits** — no `expense_items` tables, non-saving mobile
  preview in the add-expense form, no desktop concept at all. Gateway to
   Phase 3 receipt scanning.
2. **Bell badge polling** — the badge itself is no longer missing:
  `NotificationBell` renders the actionable count from `useNotifications`, and
   as of 2026-08-12 it sits in `AppHeader` on all four tabs plus the
   group-detail header. What's still open is the 30s `refetchInterval` from the
   spec, and the *nav* badges: `TabBar.tsx`'s `WebNavBadge`/`NAV_BADGES` slot is
   still fed a hardcoded empty object, and `Sidebar.tsx` has no badge slot.
3. **Public expense share page** (`/expense/[share_token]`) — 60-line
  skeleton, no service-role fetch. This is a core differentiator per the
   original spec (the restaurant moment — view a split with no account).
4. **Edit-history viewer** — data's captured in `expense_history` on every
  edit, zero UI to read it.
5. **Cross-group "Settle all with [person]"** — home aggregates per-person
  totals across groups, but the one-tap multi-group settle isn't built.
6. **Sidebar balance signals** — deliberately skipped in the 2026-08-13
  sidebar redesign (below), not because it's hard, just scoped out. Two
  specific things were decided *against* for this pass, not merely
  forgotten:
   - A per-group balance dot in the sidebar's group list (owed/owe color).
   - A net balance line in the sidebar's bottom profile card.
   Both are one-line additions — `useGlobalBalances()` already exposes
   `netPerGroup[groupId][myId]` and the aggregate `net[myId]` (Home reads
   the same hook at `page.tsx:324` and `page.tsx:108`). The reason they were
   left out: `Sidebar` mounts on every dashboard route, including ones that
   don't otherwise call `useGlobalBalances()` (e.g. a single group detail
   page). Wiring it in would upgrade the sidebar from a cheap `['groups']`
   list query to `useGlobalBalances()`'s full N-group expense/settlement
   fan-out (via `useAllGroupData`) on every navigation, not just Home/Groups.
   Revisit if/when that fan-out cost is addressed (e.g. a lighter
   balances-only query) or judged acceptable as-is.

**App shell + button system shipped 2026-08-12** (`docs/features.md`
§ Key components): the four tab pages now share `AppHeader` (title/greeting,
optional action, notification bell, avatar), so the bell is reachable from
every tab rather than only from inside a group, and `.home-topbar*` CSS became
`.app-header*`. `Btn` was reintroduced and adopted by every page- and
sheet-level CTA (~19 files), `AvatarStack` was extracted from the hand-rolled
overlapping avatar rows (group-detail strip, `FeedCard`'s "split N ways" —
which gains a `+N` chip it never had, having previously just sliced to four
and dropped the rest), and the groups list was rebuilt on emoji tile + avatar
stack + a signed amount (or `square ✓`) in place of `BalanceBadge`. UI only —
no schema, query, or balance-math change, except the `useNotifications`
group-join fix noted in `features.md`.

**Sidebar redesign shipped 2026-08-13** (`docs/features.md` § Key
components, `Sidebar.tsx`): nav trimmed from 4 destinations to 3
(Home/Groups/Activity) — `Me` is no longer a nav item, identity/settings are
reached via a new bottom profile card (avatar + name, click → `/me`) that
replaces the old dashed "+ New group" button. Group creation moved to an
inline "+" next to the "Groups" section label instead. This was a UI-only
pass — see item 6 above for the balance data that was explicitly scoped out.

**Global "Add expense" shipped 2026-08-13** (`AppHeader.tsx`): `action`
defaults to `{ label: 'Add expense', onClick: () => setFabOpen(true), hideOnMobile: true }`
when a page doesn't override it, so Groups/Activity/Me picked it up with zero
per-page changes. `ModeSheet` (`useUIStore().fabOpen`) was already fully
built — this just wires the first real caller to `setFabOpen(true)`. Home's
old "New group" override (redundant since group creation moved to the
sidebar) was removed 2026-08-13 once `page.tsx` cleared of the other
session's unrelated changes — all four tab pages now show "Add expense" on
desktop. `hideOnMobile` is on by design here (added same day as
`DockedTabBar`, below) — the header button is desktop-only, mobile's global
entry point is the docked bar's center Add. Group detail deliberately keeps
its own bespoke, always-group-scoped Add Expense button (desktop header-band
+ was also a mobile floating CTA, removed 2026-08-13 as redundant once the
center nav button existed — see below) and never goes through `ModeSheet` —
see "Architecture rules" in `CLAUDE.md` on why group context comes first.
Still open: `ModeSheet`'s "Add to a group" branch routes to `/groups` rather
than a specific group, since `activeGroupId` is set nowhere in the app.

**Mobile nav — docked bar variant added 2026-08-13, currently live**
(`DockedTabBar.tsx`): the "docked bar + elevated center Add" option from the
"Header & Sidebar Variants" design exploration, mounted in
`(dashboard)/layout.tsx` in place of the floating-pill `TabBar`. Center
button calls `setFabOpen(true)` (same `ModeSheet` entry point as the desktop
header). `TabBar.tsx` is untouched and still exported — swapping back is a
one-line import change in the layout if the docked bar doesn't win out. Note
that swapping back also un-hides the redundancy this removed: the header's
Add Expense action and the group-detail mobile floating CTA were both hidden
below 1024px / deleted specifically because this component's center button
now covers that job — reverting to `TabBar` (no center action) would leave
mobile without a global Add Expense entry point until those are revisited.
`NAV_TABS`/`pathnameToTab` were extracted to `nav/navTabs.ts` so both
components share one source of truth instead of drifting. Not yet decided:
which one ships for real; this is a live A/B to look at, not a final call.

**Guest claim flow shipped 2026-08-11** (`docs/flows.md` § Claim a guest
seat, `docs/group-member-model.md` § Claiming): self-serve claim link
(`/claim/[token]`, `claim_seat()` RPC) and an assisted, confirmation-required
invite path (`/api/groups/members/claim-invite`). The same session also
fixed the invite-link cold-lookup bug (see `publish-roadmap.md` § 3) and
added the "Invite to group" copy-link UI to group settings.

**Group settings shipped 2026-07** (`group-settings` branch, PR #1): route,
rename (name + emoji), member list with live balances, add member, admin
remove-member (blocked while unsettled), leave group, delete group (blocked
until all balances are $0.00 — see `DeleteGroupSheet`). `GroupActionMenu`
(the ellipsis bottom-sheet) was deleted 2026-07-26 — both group-detail
triggers now route straight to the settings page via a settings-gear icon,
no menu step. Two gaps remain: invite-link
management (the token exists in the schema and is used by `/invite/:token`,
but nothing in the UI shows or copies it — link-based invites are currently
unreachable) and cancelling a pending invite (pending members render as a
read-only list item with no action; `/api/groups/members/remove` explicitly
rejects non-`active` targets).

## What specifically needs desktop design work

- **Home dashboard 3-column layout** — has an existing design reference
(`home-overview.jsx` in the design project); purely layout/rendering work,
all data is already fetched.
- **Expense action sheet on desktop** — done 2026-07-26 (§19e): migrated to
`ModalOrSheet`, centered ~460px modal on desktop, Vaul drag-to-dismiss on
mobile. Built from the "Desktop A — faithful port" direction in the
`splitter` design project. Not yet exercised live in a browser.
- **Modal sizing stragglers** — resolved 2026-07-26: `DeleteGroupSheet` and
`ExpenseActionSheet` both migrated to `ModalOrSheet`. Every sheet in the app
is now viewport-aware — nothing left hand-rolling its own chrome.
(`AddMemberModal`/`NewGroupModal` were dead code, deleted 2026-07-13;
`GroupActionMenu` deleted 2026-07-26.)
- **Group settings** — shipped as a centered mobile card (520px max-width,
mobile-style back-button header) that renders identically at every
viewport. Needs the same treatment group detail got: a real desktop layout,
not the mobile page stretched into a column.
- **Itemized split builder** — the mobile non-saving preview is a starting
point for direction; desktop is a blank page.

## Rough impact ranking

Itemized splits and the public share page are now the two biggest
genuinely-missing pieces. Group settings' remaining gaps (invite-link UI,
cancel-pending-invite) are smaller, scoped follow-ups rather than a missing
feature.