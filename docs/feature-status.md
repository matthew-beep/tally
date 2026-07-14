# Feature status — mobile + desktop

Snapshot from a 2026-07-12 codebase audit. "Done" means working end-to-end
today, on that form factor. This is a point-in-time review document, not a
task list — see `TODO.md` for actionable next steps and priority order.

## Core features


| Feature                                        | Backend | Mobile | Desktop | What's missing                                                                               |
| ---------------------------------------------- | ------- | ------ | ------- | -------------------------------------------------------------------------------------------- |
| Auth + onboarding (Google, @handle)            | ✅       | ✅      | ✅       | —                                                                                            |
| Group create / list                            | ✅       | ✅      | ✅       | —                                                                                            |
| Group detail (feed, balances, members)         | ✅       | ✅      | ✅ 2-col | Avatar tap → person sheet (blocked on global data prefetch)                                  |
| Add members (search, invite link, QR, guests)  | ✅       |        |         | —                                                                                            |
| Invite accept / decline → guest conversion     | ✅       |        |         | —                                                                                            |
| Add expense (equal / exact / percentage)       | ✅       | ✅      |         | —                                                                                            |
| Edit / delete expense (audited, soft delete)   | ✅       | ✅      | ⚠️      | Desktop presentation is the mobile floating cards (§19e); split editing; edit-history viewer |
| Balances + debt simplification                 | ✅       | ✅      | ⚠️      | Home is single-column on desktop — 3-col dashboard not built; balance-card expand modal      |
| Settle up + confirm / deny                     | ✅       |        |         | Cross-group "settle all with person"                                                         |
| Activity feed (global tab)                     | ✅       |        |         | Works, but it's a bare 48-line list — no desktop enrichment                                  |
| Notifications (Me page)                        | ✅       | ✅      | ✅       | Bell badge (30s poll) not built — nav has the badge component, nothing feeds it              |
| Profile / Me (display name, handle, QR, theme) | ✅       | ✅      |         | —                                                                                            |


**The through-line:** the mobile core loop is complete — a group of people
can sign up, split, and settle entirely on phones today. Desktop is
functional everywhere but *designed* (not just "the mobile layout at a wider
viewport") in only two places: group detail's 2-column layout and the
sidebar nav.

## Core features not yet developed at all

1. **Group settings + leave group** — the biggest missing core feature:
  rename, invite-link management, member removal, leave, delete-when-zeroed.
   Menu items exist (`GroupActionMenu`) with no flows behind them. Needs
   design for both form factors.
2. **Itemized splits** — no `expense_items` tables, non-saving mobile
  preview in the add-expense form, no desktop concept at all. Gateway to
   Phase 3 receipt scanning.
3. **Bell badge** — plumbing half-exists: `WebNavBadge` component and a
  `NAV_BADGES` slot already render in `TabBar.tsx`, just fed from a
   hardcoded empty object. Desktop `Sidebar.tsx` has no badge slot at all yet.
4. **Public expense share page** (`/expense/[share_token]`) — 60-line
  skeleton, no service-role fetch. This is a core differentiator per the
   original spec (the restaurant moment — view a split with no account).
5. **Edit-history viewer** — data's captured in `expense_history` on every
  edit, zero UI to read it.
6. **Guest claim flow** — guests work as split placeholders, but can't claim
  their history into a real account (Phase 2 by design).
7. **Cross-group "Settle all with [person]"** — home aggregates per-person
  totals across groups, but the one-tap multi-group settle isn't built.

## What specifically needs desktop design work

- **Home dashboard 3-column layout** — has an existing design reference
(`home-overview.jsx` in the design project); purely layout/rendering work,
all data is already fetched.
- **Expense action sheet on desktop** — currently renders as mobile floating
cards on every viewport; needs a desktop treatment (centered modal or
popover), alongside the planned §19e Vaul bottom-sheet conversion for mobile.
- **Modal sizing stragglers** — only `AddExpenseForm`, `BalanceSheet`, and
`PersonProfileSheet` use the viewport-aware `ModalOrSheet` primitive;
`GroupActionMenu` and `DeleteGroupSheet` are hand-rolled and need a desktop
sizing audit. (`AddMemberModal`/`NewGroupModal` were dead code, deleted
2026-07-13.)
- **Group settings** — needs design from scratch, both form factors, since
nothing exists yet.
- **Itemized split builder** — the mobile non-saving preview is a starting
point for direction; desktop is a blank page.

## Rough impact ranking

Group settings, itemized splits, and the public share page are the three
biggest genuinely-missing pieces, roughly in that order of user impact.