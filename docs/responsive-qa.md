# Responsive QA — test process per feature

_Written 2026-08-03. Breakpoints below were read out of `globals.css`,
`dashboard.css` and `useMediaQuery.ts`, not assumed. Run this sweep before a
release; record results in `feature-status.md`'s Mobile/Desktop columns, which
are currently blank for several rows because nobody has systematically checked._

---

## The breakpoint contract

Three zones, because the JS and CSS breakpoints do not divide the space the same
way:

| Zone | Width | Nav chrome | Page layouts | Sheets / modals |
|---|---|---|---|---|
| **Mobile** | ≤ 767px | Tab bar | Single column | Vaul bottom sheet |
| **Mixed** | 768–1023px | Tab bar | Single column | **Centered desktop modal** |
| **Desktop** | ≥ 1024px | Sidebar | 2-column | Centered desktop modal |

`useIsMobileSheet()` switches at `max-width: 767px`. The layout CSS switches at
`max-width: 1023px` (`dashboard.css:10`, `:191`, `:383`). They disagree across a
256px-wide band.

### ⚠️ The mixed zone is a known inconsistency, not a tested state

At 768–1023px — **iPad portrait, small laptop windows, split-screen** — you get
mobile navigation and mobile page layouts, but desktop modals. Concretely:
`AddExpenseForm` renders `DesktopPanel` (the two-column tiles-left/split-right
layout) inside a centered modal, while the page behind it is the single-column
mobile group detail with a tab bar.

This has never been designed or verified. **Decide before launch:** either move
`useIsMobileSheet` to `max-width: 1023px` so sheet presentation follows the nav
chrome, or commit to the mixed state and design for it. The one-line breakpoint
change is the cheap option and probably correct — the sheet/tab-bar pairing is
what users expect on a tablet.

Other breakpoints: `640px` and `680px` (minor), `399px` (the shared `AppHeader`
collapses an action button's label to a `+` icon — check the narrow phone case).

Since 2026-08-12 the header is shared by all four tab pages (`.app-header*`,
formerly `.home-topbar*`), so header checks below apply to Home, Groups,
Activity and Me alike — the `≤1023px` "hide the duplicate action" rule
(`.app-header-action--hide-mobile`) is Home's "New group" only.

---

## How to run it

**Viewports.** Chrome DevTools device toolbar at: `375×667` (iPhone SE — the
tightest realistic phone), `430×932` (iPhone 16 Pro Max), `820×1180` (iPad
portrait — the mixed zone), `1280×800`, `1680×1050`.

**At least one real device.** DevTools does not reproduce dynamic browser chrome,
which is exactly what the known `100dvh` / app-background bug depends on
(`TODO.md` item 8). Safari iOS and Chrome Android both matter; Safari is where
`100%`-height backgrounds fail.

**Both themes.** Every check runs in light and dark — `globals.css` defines a
full dark palette, and dark is the less-exercised path.

---

## Universal checks — every screen, both form factors

Run these on each route before the per-feature list:

- [ ] No horizontal scroll at 375px. Nothing clipped at 320px.
- [ ] App background covers the full viewport, including after scrolling and
      after mobile browser chrome collapses. *(Known failure — item 8.)*
- [ ] Safe-area insets respected: tab bar clears the iPhone home indicator,
      sheet content clears the notch.
- [ ] Every sheet: opens at a stable height, scrolls internally, drag-to-dismiss
      works, background does not scroll behind it.
- [ ] Long content doesn't break layout — 40-character group name, 6+ members,
      `$12,345.67` amounts.
- [ ] Tap targets ≥ 44px on mobile.
- [ ] Keyboard doesn't cover the focused input or the primary action button.
- [ ] Loading and empty states render at both sizes, not just populated ones.
- [ ] Tab pages: `AppHeader` stays put while the body scrolls under it (it is
      `flex-shrink: 0` above a `DashboardPage` scroll area, not `sticky`), bell
      and avatar stay tappable, title doesn't collide with the action button.

---

## Per-feature matrix

Legend: **M** = ≤767px, **T** = 768–1023px (mixed), **D** = ≥1024px.

### Auth + onboarding
| Check | M | T | D |
|---|---|---|---|
| Google sign-in button reachable, no clipping | ☐ | ☐ | ☐ |
| Handle input: live availability, suggestion, keyboard doesn't cover Continue | ☐ | ☐ | ☐ |
| `?redirect` deep link survives sign-in | ☐ | ☐ | ☐ |

### Home / balances
| Check | M | T | D |
|---|---|---|---|
| Hero amount doesn't wrap or clip at 375px and at `$10,000+` | ☐ | ☐ | ☐ |
| Person rows: mobile flat card list vs desktop 2-column `BalanceTable` | ☐ | ☐ | ☐ |
| "New group" label collapses to icon below 399px, and the button hides entirely below 1024px (Groups has its own) | ☐ | — | — |
| Needs-attention rail: present on desktop, reachable on mobile | ☐ | ☐ | ☐ |
| All-square empty state | ☐ | ☐ | ☐ |

### Groups list / create group
| Check | M | T | D |
|---|---|---|---|
| Group card: avatar stack + `+N` overflow, long name truncates before the amount | ☐ | ☐ | ☐ |
| `square ✓` chip vs signed amount — both fit the row at `$12,345.67` | ☐ | ☐ | ☐ |
| Emoji picker sheet opens and is dismissible | ☐ | ☐ | ☐ |
| `MemberCombobox`: results list scrolls, doesn't cover the input | ☐ | ☐ | ☐ |
| Guest add path | ☐ | ☐ | ☐ |
| 816-line page — check for layout drift at every width | ☐ | ☐ | ☐ |

### Group detail
| Check | M | T | D |
|---|---|---|---|
| Mobile header + avatar strip vs desktop topbar + header band (`≥1024`) | ☐ | ☐ | ☐ |
| Body: single column vs 2-column with members ledger | ☐ | ☐ | ☐ |
| Collapsible balance card (mobile only) expands/collapses | ☐ | — | — |
| Month-bucketed feed; "split N ways" avatars desktop-only | ☐ | ☐ | ☐ |
| Floating Add-expense CTA doesn't cover the last feed row | ☐ | ☐ | — |
| Empty state with member preview | ☐ | ☐ | ☐ |

### Add expense — **highest-risk screen for the mixed zone**
| Check | M | T | D |
|---|---|---|---|
| Correct panel renders (Mobile ≤767 / Desktop ≥768 — verify T is intended) | ☐ | ⚠️ | ☐ |
| Sheet holds a fixed height across mode switches | ☐ | ☐ | ☐ |
| Equal: toggle members, per-person amount updates | ☐ | ☐ | ☐ |
| Exact: seeded even, sums exactly, remainder pill agrees with Save button | ☐ | ☐ | ☐ |
| Percentage: 3-way seeds to exactly 100%, not 99.9% | ☐ | ☐ | ☐ |
| Enter amount *after* switching mode — fields re-seed, Save unblocks | ☐ | ☐ | ☐ |
| Itemized shows coming-soon, Save stays disabled | ☐ | ☐ | ☐ |
| `?add=1` deep link opens the sheet | ☐ | ☐ | ☐ |

### Edit / delete expense
| Check | M | T | D |
|---|---|---|---|
| Action sheet → edit → delete-confirm screens all fit | ☐ | ☐ | ☐ |
| Dirty dots, amount rescale preserves split shape | ☐ | ☐ | ☐ |
| Delete confirm states the member count | ☐ | ☐ | ☐ |

### Settle up — group
| Check | M | T | D |
|---|---|---|---|
| List splits "Owed to you" / "You owe" | ☐ | ☐ | ☐ |
| Record-payment screen: amount editable, note field, keyboard clearance | ☐ | ☐ | ☐ |
| Preselect from a per-member button skips the list | ☐ | ☐ | ☐ |
| Sheet height stable between the two screens *(known issue — item 8)* | ☐ | ☐ | ☐ |

### Settle up — cross-group (dashboard)
| Check | M | T | D |
|---|---|---|---|
| Balance sheet → per-group drill-down, back nav works | ☐ | ☐ | ☐ |
| Full/Half/Clear chips, editable amount clamps to the balance | ☐ | ☐ | ☐ |
| Settle-all confirm lists every group | ☐ | ☐ | ☐ |
| *Blocked: both CTAs are no-ops until roadmap P0 item 2* | — | — | — |

### Notifications
| Check | M | T | D |
|---|---|---|---|
| Home rail renders invite + settlement-confirm cards | ☐ | ☐ | ☐ |
| Confirm / deny buttons fit side by side at 375px | ☐ | ☐ | ☐ |
| `/me` list renders and marks read | ☐ | ☐ | ☐ |

### Group settings
| Check | M | T | D |
|---|---|---|---|
| 520px centered card — verify it's acceptable on wide desktop | ☐ | ☐ | ⚠️ |
| Rename + emoji, member list with balances | ☐ | ☐ | ☐ |
| Remove member blocked while unsettled; leave; delete blocked until $0 | ☐ | ☐ | ☐ |
| Pending invites show ⏳ | ☐ | ☐ | ☐ |
| Invite link row *(not built — roadmap P0 item 3)* | — | — | — |

### Invite accept / decline
| Check | M | T | D |
|---|---|---|---|
| `/invite/[token]` as a signed-out stranger *(currently fails — P0 item 3)* | ☐ | ☐ | ☐ |
| Accept → joins and lands in the group | ☐ | ☐ | ☐ |
| Decline → guest conversion preserves history | ☐ | ☐ | ☐ |

### Profile / Me · QR
| Check | M | T | D |
|---|---|---|---|
| Display name + handle edit, availability check | ☐ | ☐ | ☐ |
| QR code renders and scans; theme toggle applies live | ☐ | ☐ | ☐ |
| `/add/[add_code]` destination renders for a scanned code | ☐ | ☐ | ☐ |

### Activity
| Check | M | T | D |
|---|---|---|---|
| Chronological feed, group shown as row metadata | ☐ | ☐ | ☐ |
| Long descriptions ellipsis rather than wrap | ☐ | ☐ | ☐ |

---

## Recording results

Fill in `feature-status.md`'s Mobile/Desktop columns from this sweep — several
are blank purely because no one has checked, which is indistinguishable from
"broken" when reading that table. Add a **Tablet** column if the mixed zone
survives as an intentional state.
