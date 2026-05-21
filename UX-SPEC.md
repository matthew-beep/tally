# Tally — UX Specification

## Overview

### Problem
Groups accumulate a tangled web of shared costs. Tracking manually is error-prone and awkward. Splitwise fixes it but gates core features — debt simplification, receipt scanning — behind a paywall.

### Solution
A shared expense ledger that calculates the minimum transfers to zero everyone out, makes settling a one-tap action, and adds receipt scanning — all completely free with no feature tiers.

### Design Principles

| Principle | Description |
|---|---|
| **Speed first** | Add expense in under 15 seconds from the home screen. Every extra tap is a tax on trust. |
| **Math disappears** | Users see plain English — "you owe Sam $60" — never raw arithmetic or bilateral debt lists. |
| **Minimum transfers** | Debt simplification collapses 10 IOUs to 2–3 payments. Always show the simplified view by default. |
| **Fully free** | Every feature unlocked. No paywalls, no upsell banners. The entire value prop is being Splitwise without the friction. |

---

## Visual Language

### Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#EBE5D8` | App background |
| `surface` | `#F5F0E8` | Cards, inputs, raised elements |
| `ink` | `#1F1A14` | Primary text, filled buttons |
| `inkMuted` | `rgba(31,26,20,0.52)` | Secondary text, labels |
| `inkFaint` | `rgba(31,26,20,0.28)` | Placeholder, disabled text |
| `line` | `rgba(31,26,20,0.07)` | Subtle separators |
| `lineStrong` | `rgba(31,26,20,0.16)` | Input borders, stronger dividers |
| **Sun** | `#F2C144` | Brand accent, logo mark, "You" avatar, info highlights |
| **Mint** | `#2DB97A` | Positive balances, "you're owed", success states, settlements |
| **Coral** | `#EF6144` | Negative balances, "you owe", destructive actions, errors |
| **Lavender** | `#9179EF` | 4th-member avatar — no semantic meaning, purely visual variety |

Each accent colour has three values: base, soft background (e.g. `mintBg: #D3F5E5`), and dark ink (e.g. `mintInk: #0A5C35`).

### Typography

**Bricolage Grotesque** — display face. Used for: app name, screen titles, monetary amounts, avatar initials. Weight 600–800.

**Plus Jakarta Sans** — UI face. Used for: labels, body copy, buttons, input text, section headings. Weight 400–700.

Monospace amounts (e.g. balance deltas in activity feeds) use **JetBrains Mono**.

### Member Avatars

Colour assignment is deterministic by join order:

| Slot | Colour | Text colour |
|---|---|---|
| You (always) | Sun `#F2C144` | `#7A5200` |
| Member 2 | Mint `#2DB97A` | White |
| Member 3 | Coral `#EF6144` | White |
| Member 4 | Lavender `#9179EF` | White |

Avatar shows 2-letter initials in Bricolage Grotesque. Font size = `size × 0.33`. Available at any size — the component accepts a `size` prop.

---

## User Flows

Three flows make up 90% of sessions.

### Add Expense (hero flow)
Target: completable in under 15 seconds from the home screen.

```
Groups list → [tap group] → Group detail → [+ Add expense] → Add expense form → [Save] → Updated balances
```

### Create a Group
New user entry point. Name + emoji, then land on an empty group detail ready to add expenses.

```
Groups list → [+ New group] → Create group → [Create] → Empty group detail
```

### Settle Up
Triggered from group detail. Pre-fills with the largest outstanding debt involving "you".

```
Group detail → [Settle up] → Settle up form → [Record payment] → Zero balance
```

**Shared state note:** All three flows write into the same data store. A new expense added anywhere immediately updates all group balances. Settlements are ledger entries only — they adjust the calculated balance but don't move money or talk to any payment API.

---

## Screens

Six screens cover the entire v1 app. Expense Detail ships in Phase 2.

### Groups List
*Phase 1 · Home screen*

Entry: app launch, back from any group.
Exit: Group detail, Create group.

**Purpose:** Net balance across all groups at a glance, with a card per group showing that group's balance.

**Key elements:**
- Balance hero: total owed or owing in large Bricolage Grotesque
- Group cards: emoji, name, member count, your balance badge
- `+ New group` button (top right)

---

### Group Detail
*Phase 1 · Primary group view*

Entry: tap a group card.
Exit: Add expense, Settle up, back to Groups list.

**Purpose:** Member balances, simplified debt transfers, chronological expense list.

**Key elements:**
- Member balance list with badge per person
- "Who pays who" — simplified min-transfer view (hidden when everyone is settled)
- Expense list newest-first: description, who paid, your share
- `+ Add expense` (primary CTA) + `Settle up` (secondary)
- Settlements log section (if any recorded)

---

### Add Expense
*Phase 1 · The hero form*

Entry: `+ Add expense` from group detail.
Exit: Group detail (on save or cancel).

**Purpose:** Fast path is description → amount → save. Advanced options change the payer, adjust who's included, or switch to exact amounts.

**Key elements:**
- Description field
- Amount — large Bricolage Grotesque input
- Paid by: member pill selector (defaults to you)
- Split: equal (default) or exact amounts toggle
- Inclusion toggles with live share preview for equal split
- Date picker (defaults to today)
- Save (disabled until valid) / Cancel

---

### Settle Up
*Phase 1*

Entry: `Settle up` from group detail.
Exit: Group detail (on save or cancel).

**Purpose:** Record that money changed hands outside the app. Writes a settlement entry that adjusts calculated balances.

**Key elements:**
- From → To avatar visual (pre-filled from largest debt)
- Paying selector if multiple creditors
- Amount (pre-filled from largest debt)
- Note field: "Venmo", "cash", etc.
- Date picker
- `Record payment` CTA

---

### Create Group
*Phase 1*

Entry: `+ New group` from groups list.
Exit: Group detail (empty state).

**Purpose:** Spin up a new group. Emoji picker + name. You're added as member 1 automatically — member invites happen after creation.

**Key elements:**
- Emoji picker (12 options in a grid)
- Group name field
- Info note: "invite others after creating"
- Create CTA (disabled until name is non-empty)

---

### Expense Detail
*Phase 2*

Entry: tap an expense row in group detail.
Exit: Group detail.

**Purpose:** Full breakdown of one expense. Read-only for most users, editable by the creator.

**Key elements:**
- Paid by, date, description
- Per-person split breakdown
- Edit button (creator only)
- Delete (creator only — requires confirm dialog)

---

## Interaction Patterns

### Screen Transitions
Every screen mount uses a single animation: `translateY(12px) → 0` + `opacity 0 → 1`, 180ms ease-out. One animation type across the whole app. No directional slide-left/right — directional transitions add cognitive overhead without orientation benefit in a shallow 3-level hierarchy.

### Balance Display Logic

Always use the balance badge component — never render `+/-` as plain coloured text.

| State | Pill colour | Label |
|---|---|---|
| Positive (owed to you) | Mint | "owed to you" |
| Negative (you owe) | Coral | "you owe" |
| Zero (settled) | Neutral grey | No sublabel shown |

### Add Expense — Split Type

Default is **equal split**. Each included member shows their computed share in real time as the amount changes.

Toggling to **exact amounts** reveals a number input per member. Validation: exact amounts must sum to the total ± $0.02 (rounding tolerance). Save stays disabled and an inline Coral error appears until they balance.

### Debt Simplification

The "Who pays who" section always shows the **minimum number of transfers** to zero everyone out, not raw bilateral debts. For a 5-person group with 15 transactions, this typically reduces to 3–4 payments. The section is hidden entirely when everyone is settled.

**Algorithm (greedy, O(n log n)):**
1. Calculate net balance per person: sum of splits paid minus splits owed minus settlements.
2. Sort into creditors (+) and debtors (−) by magnitude.
3. Match largest debtor to largest creditor, record the transfer, reduce both by the payment amount, repeat.
4. Stop when everyone is at $0.00.

### Member Inclusion in Expenses

All group members are included by default. Tapping a member toggles their inclusion. For equal splits, the share updates live (e.g. a $90 dinner goes from $30/person at 3 people to $45/person if one person is excluded). Excluded members get no split row written — their balance is unaffected.

### Empty States

| State | Treatment |
|---|---|
| New group (no expenses) | "No expenses yet. Add one above." Centred, muted, inside the expense card. No illustration. |
| All settled (zero balance) | Hero shows "—" in muted ink. Label: "All settled up." Settle up button is hidden. |
| No groups yet | Single prompt card with `+ New group` CTA prominent. Copy: "Create a group to start splitting." |

No illustrations in empty states — they add noise without value.

### Form Validation

Save is **disabled (opacity 0.36)** until the form is valid. Errors appear inline below the field in Coral — never as toasts or alerts.

| Field | Rule |
|---|---|
| Description | Required, non-empty |
| Amount | Required, greater than $0.00 |
| Included members | At least 1 selected |
| Exact split | Amounts must sum to total (±$0.02) |
| Settle up amount | Must be greater than $0.00 |

---

## Components

### Avatar
Circular badge with 2-letter initials. Deterministic colour by member slot (see Visual Language). Font: Bricolage Grotesque 700, size × 0.33. Available at any size via `size` prop.

### Balance Badge
Three states: Mint pill (positive), Coral pill (negative), neutral grey pill (settled/zero). Font: Plus Jakarta Sans 700, 13px. Always use this component — never render raw `+/-` in plain coloured text.

### Button — 3 Variants

| Variant | Usage | Style |
|---|---|---|
| Fill (primary) | Save expense, Record payment | Ink background, cream `#F4EEE3` text |
| Subtle (secondary) | Settle up, secondary actions | Warm transparent bg, `lineStrong` border |
| Ghost (tertiary) | Cancel, nav/dismiss | Transparent, `inkMuted` text |

All buttons: Plus Jakarta Sans 600, `borderRadius 12px`. Disabled state: `opacity 0.36`.

### Member Pill Selector
Used in Add Expense for "Paid by" and per-member inclusion toggles.

- **Selected:** Ink background, cream text, 2px ink border
- **Unselected:** Surface background, `lineStrong` border

Always includes the avatar for recognition without reading text.

### Card
Surface background `#F5F0E8`, `borderRadius 18px`, warm box shadow (light mode only — no heavy border). Section heads inside cards: 10px uppercase, `inkMuted`, 0.5px warm separator. Row padding: 12px 16px, 0.5px warm row separator, `surfaceHov` on hover.

### Input — Text and Amount Variants

**Text input:** Surface bg, 1px `lineStrong` border, `borderRadius 12px`. On focus: border darkens to ink + 3px warm box shadow. Placeholder: `inkFaint`. Font: Plus Jakarta Sans 14px.

**Amount input:** Same base as text input, but font is Bricolage Grotesque 700 at 26–28px with `letterSpacing -0.5`.
