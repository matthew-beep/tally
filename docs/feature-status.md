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
| Notifications (Me page)                        | ✅       | ✅      | ✅       | Bell badge (30s poll) not built — nav has the badge component, nothing feeds it              |
| Profile / Me (display name, handle, QR, theme) | ✅       | ✅      |         | —                                                                                            |
| Group settings (rename, members, leave, delete)| ✅       | ✅      | ⚠️      | Invite link (show/copy/regenerate) not surfaced anywhere in the UI; pending invites render read-only with no cancel action; desktop is the mobile 520px-centered card layout, not a designed 2-col treatment |


**The through-line:** the mobile core loop is complete — a group of people
can sign up, split, and settle entirely on phones today. Desktop is
functional everywhere, and as of 2026-07-26 every sheet/modal in the app
renders through the shared `ModalOrSheet` primitive (centered modal on
desktop, not the mobile layout stretched wide). The bigger *designed*
(not just "the mobile layout at a wider viewport") treatments remain
narrower: group detail's 2-column layout and the sidebar nav. Home's
3-column dashboard and group settings' desktop layout are still open.

## Core features not yet developed at all

1. **Itemized splits** — no `expense_items` tables, non-saving mobile
  preview in the add-expense form, no desktop concept at all. Gateway to
   Phase 3 receipt scanning.
2. **Bell badge** — plumbing half-exists: `WebNavBadge` component and a
  `NAV_BADGES` slot already render in `TabBar.tsx`, just fed from a
   hardcoded empty object. Desktop `Sidebar.tsx` has no badge slot at all yet.
3. **Public expense share page** (`/expense/[share_token]`) — 60-line
  skeleton, no service-role fetch. This is a core differentiator per the
   original spec (the restaurant moment — view a split with no account).
4. **Edit-history viewer** — data's captured in `expense_history` on every
  edit, zero UI to read it.
5. **Guest claim flow** — guests work as split placeholders, but can't claim
  their history into a real account (Phase 2 by design).
6. **Cross-group "Settle all with [person]"** — home aggregates per-person
  totals across groups, but the one-tap multi-group settle isn't built.

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