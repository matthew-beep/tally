# Tally Design System

> **Friendly, fast, paid up.**

Tally is a PWA for splitting costs with friends. Two modes: **Groups** for the people you spend with regularly, **Quick Split** for the bill in front of you right now.

| Version | Surfaces | Type families | Components |
|---|---|---|---|
| v0.2 · 21 May 2026 | iOS PWA · Web | 3 | 22 documented |

---

## Table of Contents

**Foundations**
1. [Brand](#1-brand)
2. [Color](#2-color)
3. [Typography](#3-typography)
4. [Spacing & Radius](#4-spacing--radius)
5. [Elevation](#5-elevation)
6. [Iconography](#6-iconography)

**Components**
7. [Avatars](#7-avatars)
8. [Buttons](#8-buttons)
9. [Pills & Chips](#9-pills--chips)
10. [Cards](#10-cards)
11. [Inputs](#11-inputs)
12. [Receipt Block](#12-receipt-block)
13. [Bottom Sheet](#13-bottom-sheet)
14. [Tab Bar](#14-tab-bar)

**Money**
15. [Numbers & Balances](#15-numbers--balances)

**Patterns**
16. [Dual-Mode Entry](#16-dual-mode-entry)
17. [Auto-Categorize](#17-auto-categorize)
18. [Principles](#18-principles)

---

## 1. Brand

Tally is warm but not cute, plainspoken but not flat. The mark is a soft **T tile** in the sun color, paired with a lowercase Bricolage wordmark. Money apps usually feel clinical; this one should feel like a friend offering to do the math.

**Logo tokens:** `logo.tile` · `wordmark.lowercase`

### Voice Principles

| Principle | Description |
|---|---|
| **Plain about money** | Say "you owe Sam $24", not "you have an outstanding balance". |
| **Never punitive** | Owe states are coral, not red. No scolding. |
| **Warm, not cute** | No emoji stuffing in body copy. Emojis live with categories and groups. |
| **Numbers first** | Amounts are always the largest thing on screen. |

---

## 2. Color

One warm cream base, two clean surface tones, semantic mint/coral for direction-of-debt, and sun as the brand accent. Lavender appears anywhere we bridge the two modes. Light and dark palettes are paired one-to-one.

### Token Reference

**Surfaces**

| Token | Light | Note |
|---|---|---|
| `bg` | `#F4EEE3` | Warm cream — never pure white |
| `surface` | `#FFFFFF` | Card background — clean white |
| `surfaceAlt` | — | Sub-card / footer wells |

**Ink**

| Token | Usage |
|---|---|
| `ink` | Primary text |
| `inkMuted` | Secondary / supporting text |
| `inkFaint` | Disabled / placeholder |

**Lines**

| Token | Usage |
|---|---|
| `line` | Default hairline borders |
| `lineStrong` | Emphasis borders |

**Semantic**

| Token | Note |
|---|---|
| `mint` / `mintSoft` / `mintInk` | Owed to you — gentle green |
| `coral` / `coralSoft` / `coralInk` | You owe — warm peach, never red |

**Brand**

| Token | Note |
|---|---|
| `sun` / `sunSoft` / `sunInk` | Primary CTA, FAB, brand mark |
| `lavender` | The bridge between modes |

---

## 3. Typography

Three families do three jobs. Bricolage carries the amounts and the warmth. Plus Jakarta runs the UI without drawing attention to itself. JetBrains Mono shows up for any number that needs to align in a column.

### Families

| Family | Stack | Used for |
|---|---|---|
| **Bricolage Grotesque** | `"Bricolage Grotesque", system-ui` | Display · headings · amounts |
| **Plus Jakarta Sans** | `"Plus Jakarta Sans", system-ui` | UI body · labels · names |
| **JetBrains Mono** | `"JetBrains Mono", monospace` | Tabular · metadata · code |

### Type Scale

| Size | Role | Family |
|---|---|---|
| 64px | Hero numbers | Bricolage |
| 44px | Section H1 | Bricolage |
| 30px | Screen title | Bricolage |
| 22px | Card title | Bricolage |
| 18px | Subsection | Bricolage |
| 15px | Body lead | Jakarta |
| 13px | Body | Jakarta |
| 11px | Eyebrow | Jakarta |
| 11px | Mono caption | JetBrains Mono |

---

## 4. Spacing & Radius

Spacing leans on a soft 4-step scale up to 32, with generous 18–22 radii on most cards. Pills and avatars stay perfectly round.

### Spacing Scale (px)

`4` `6` `8` `10` `12` `14` `16` `18` `20` `24` `28` `32`

### Radius Scale

| Radius | Used for |
|---|---|
| 6px | Inline tags |
| 8px | Icon buttons |
| 10px | Nav items |
| 12px | Small buttons, inputs |
| 14px | Medium cards |
| 16px | Tab bar, large buttons |
| 18px | List cards |
| 20px | Panel cards |
| 22px | Hero cards |
| 999px | Pills · circular |

---

## 5. Elevation

Most surfaces sit flat — Tally is a flat-but-warm app, not a glassmorphism app. Shadows only show up when something is genuinely floating above the content.

| Level | Shadow | Used for |
|---|---|---|
| **Resting** | none | Inside a section, on the cream bg. (0.5px line in dark mode) |
| **Lifted** | `0 1px 0 rgba(31,26,20,0.04)` | Default card on cream. |
| **Floating** | `0 8px 24px rgba(0,0,0,0.08)` | Tab bar, sticky receipt panel. |
| **Modal** | `0 30px 80px rgba(0,0,0,0.28)` | Add-expense modal, sheet over content. |

---

## 6. Iconography

Stroke icons at **1.8px** on a **24px grid**. Rounded line-caps. Filled forms only when an icon represents a piece of fixed data (avatar initials, emoji categories).

### Icon Set

`home` · `groups` · `activity` · `me` · `search` · `back` · `close` · `plus` · `camera` · `receipt` · `share` · `sparkle` · `clock` · `lock`

---

## 7. Avatars

One letter, one color, one circle. Each Tally person owns a hue from the palette so they read consistently across screens. No photos for now — names alone do the work.

### Sizes

`14` `20` `22` `26` `30` `36` `42` `56` — same proportions at all sizes.

### States

| State | Description |
|---|---|
| **Default** | Full-opacity circle with initial |
| **Dimmed** | Reduced opacity |
| **Ringed** | Outline ring for selection |
| **Stack** | Overlapping group, max visible count |

### Person Colors

Each person gets a fixed hue assigned from the palette. The color shows in their avatar, person pills, and anywhere their name appears.

---

## 8. Buttons

Ink for confirmation, sun for the brand moment, ghost for secondary actions. Only one ink button per screen — it's where the eye should go.

### Variants

| Variant | Style | When to use |
|---|---|---|
| **Ink** (primary) | Dark fill, cream text | Confirmation: "Save expense", "Continue with Quick Split", "Send everyone their share". |
| **Sun** (brand) | Gold fill, dark text, glow shadow | The brand moment. Mode chooser, FAB context. Use sparingly. |
| **Ghost** | Surface fill, strong border | "Search", "Save to group", "Scan receipt". Second-most-important actions. |
| **Dashed** | Transparent, dashed border, rounded | "+ Start a new group", "+ Add person". Suggests open-endedness. |
| **Icon** | Square, surface fill | Single icon, no label. |
| **FAB** | Large, rounded square, sun fill | The one floating action button. Sits outside the tab bar pill. |

### Button Specs

```
Ink:    padding 10px 18px · borderRadius 12 · bg ink · color bg · weight 700
Sun:    padding 10px 18px · borderRadius 12 · bg sun · boxShadow rgba(242,192,74,0.35)
Ghost:  padding 10px 16px · borderRadius 12 · bg surface · border 0.5px lineStrong
Dashed: padding 8px 14px  · borderRadius 999 · border 1.5px dashed lineStrong
Icon:   36×36 · borderRadius 12 · bg surface
FAB:    54×54 · borderRadius 18 · bg sun · boxShadow rgba(242,192,74,0.5)
```

---

## 9. Pills & Chips

The unit of UI throughout Tally — categories, people, statuses, filters. Round, compact, scannable.

### Category Pills

Emoji + label, fully rounded. Active pill uses ink background with cream text. Auto-assigned categories show a sparkle `✨` badge in the top-right corner.

### Person Pills

Avatar + name, fully rounded. Selected person uses their personal color as the background.

### Status Pills

| Status | Colors |
|---|---|
| `paid` | mintSoft bg · mintInk text |
| `square ✓` | bg · inkMuted text |
| `⋆ Auto` | sunSoft bg · sunInk text |
| `overdue` | coralSoft bg · coralInk text |
| `FREE` | mintSoft bg · mintInk text |
| `↔ saved to group` | lavender tint bg · ink text |

### Segmented Filter

Inline toggle (`All` / `Owed` / `You owe`). Active segment uses ink fill; inactive is transparent on a surface-colored track.

```
track:  bg surface · border 0.5px line · borderRadius 10 · padding 3
item:   padding 6px 14px · borderRadius 7 · weight 700
```

---

## 10. Cards

Most surfaces are cards. Generous radii (18–22), one-pixel resting shadow, ample internal padding. Cards never carry borders in light mode — they earn separation through surface tone and shadow.

### Balance Card

Big Bricolage number in mint or coral. Explicit sign prefix. Half-opacity dollar sign.

### Group Card

Emoji tile + group name + avatar stack + net balance.

### Expense Row

Emoji tile · description · payer info · total amount · net (mint or coral in mono). Dividers between rows are 0.5px `line`. No divider above the first row.

---

## 11. Inputs

The text input is plain and large. The amount input is the loudest text in the app — Bricolage at 42pt with a soft dollar sign and tabular cents.

### Description + Emoji

```
Emoji tile:  52×52 · borderRadius 14 · bg surfaceAlt
Text field:  flex 1 · height 52 · borderRadius 14 · fontSize 15 · weight 600
```

### Amount Field

```
$ sign:  fontSize 22 · weight 500 · color inkMuted
Amount:  fontFamily Bricolage · fontSize 42 · weight 600 · letterSpacing -1.5
         fontVariantNumeric tabular-nums
```

---

## 12. Receipt Block

Used in Quick Split to make the bill feel like a bill — a tactile object you're working with, not a form. Perforated bottom edge, tabular numerals, dashed divider above the per-person breakdown.

**Structure:**
- Merchant + timestamp (eyebrow, 10.5px, uppercase)
- Total in Bricolage (44px) with muted `$` prefix and mono cents
- Subtotal + tax + tip breakdown (11.5px, muted)
- Dashed divider (`1px dashed lineStrong`)
- Per-person rows: avatar · name · amount (mono, 13px, weight 700)
- Perforated bottom edge: radial-gradient circles punched from the background color

---

## 13. Bottom Sheet

On mobile, decisions happen in sheets. 28px top corners, drag handle, content padded to the safe area. Sheets always sit on a dimmed-but-visible background — you should feel like you're standing in front of the previous screen.

```
Sheet:       borderTopLeftRadius 28 · borderTopRightRadius 28 · bg surface
             padding 12px 24px 28px · boxShadow 0 -12px 40px rgba(0,0,0,0.18)
Drag handle: width 36 · height 4 · borderRadius 2 · bg lineStrong
Scrim:       rgba(15,12,8,0.18)
```

---

## 14. Tab Bar

Pill-shaped, floating above content with a soft fade behind it. The FAB sits outside the pill — it's not nav, it's an action.

**Tabs:** Home · Groups · Activity · Me

```
Track:  bg surface · borderRadius 22 · padding 8px 10px
        boxShadow 0 8px 24px rgba(0,0,0,0.08)
Active icon:   stroke ink · fillOpacity 0.12
Inactive icon: stroke inkFaint

FAB:    54×54 · borderRadius 18 · bg sun
        boxShadow 0 8px 20px rgba(242,192,74,0.5), 0 0 0 4px bg (ring gap)
```

---

## 15. Numbers & Balances

The signature treatment: a big Bricolage number, a slightly smaller dollar sign at half-opacity, and the cents trailing in JetBrains Mono. Sign is always shown explicitly — never bare numbers — because direction-of-debt is the meaning.

### Anatomy

```
Sign + $    fontSize 32 · weight 500 · opacity 0.7
Amount      Bricolage · fontSize 72 · tabular-nums
Cents       JetBrains Mono · fontSize 18 · color inkMuted
```

### Direction of Debt

| State | Color | Token |
|---|---|---|
| You're owed | Green | `mintInk` |
| You owe | Warm peach | `coralInk` |
| Square | Neutral pill | `inkMuted` |

### Format Rules

| Rule | Detail |
|---|---|
| **Always show the sign** | Even when context implies direction. "+$24.50" not "$24.50". |
| **Use the minus glyph** | U+2212 ("−"), not a hyphen. It aligns with the $ baseline. |
| **Cents in mono** | Tabular alignment matters more than visual consistency for amounts under $1,000. |
| **Drop cents in summaries** | List rows and tiles show whole dollars; the hero shows the full thing. |
| **Comma at thousands** | Standard US grouping. No currency code unless multi-currency is added. |

---

## 16. Dual-Mode Entry

Two different mental models live in Tally — async groups and synchronous quick splits. The FAB on Home is the single entry point that branches into both.

### Groups 🌲
*Async · accumulative · settle eventually*

| | |
|---|---|
| **Time horizon** | Weeks → months |
| **Intent** | Track shared spending |
| **Participants** | Members with accounts |
| **Resolution** | Periodic settle-up |

### Quick Split 🧾
*Sync · immediate · resolve right now*

| | |
|---|---|
| **Time horizon** | Right now (5 min) |
| **Intent** | Sort this one bill, fast |
| **Participants** | Names only — no account needed |
| **Resolution** | Share link → Venmo / Zelle |

### Bridge ↔

A completed Quick Split offers **"save to group"** — promoting ephemeral participants into a real group. The **lavender** tone signals "this connects the two worlds" wherever it appears.

---

## 17. Auto-Categorize

When you type a description, Tally picks an emoji and category. You can override with one tap on the pill row, and a "reset to auto" link lets you snap back.

**Auto badge:** Star sparkle pill in sunSoft/sunInk — appears next to the active category when auto-assigned.

### Category Taxonomy (22 categories)

Representative categories include: Food & Drink, Transport, Groceries, Home, Entertainment, Travel, Health, and more. Each category has an `id`, `emoji`, `label`, and `keywords` array used for matching.

---

## 18. Principles

The shorthand we use when deciding whether something feels like Tally.

| # | Principle | Description |
|---|---|---|
| 01 | **The amount is always the hero** | On every screen, the largest piece of typography is a number. People come here to know how much, not to admire the layout. |
| 02 | **Two modes, one app** | Groups and Quick Split share components and palette, but their navigation and time horizon are distinct. Don't let either eat the other. |
| 03 | **Warm cream, never pure white** | The base background is `#F4EEE3`. Pure white feels like a tax document. Tally is a friend offering to do the math. |
| 04 | **Mint and coral, never red and green** | Color-coding direction-of-debt should not feel like a warning or a celebration. Just a calm "this way" / "that way". |
| 05 | **Pills do the verbs** | Category, person, status, filter — wherever the user is choosing among a small set, a row of pills is the answer. |
| 06 | **Numbers in mono align; numbers in Bricolage punch** | When numbers are in a column or a small caption, JetBrains Mono. When they're the answer to a question, Bricolage. |

### Working with this System

Tokens and components live in `tally-shared.jsx`. The two main entry points are `Tally.html` (every screen on a canvas) and this style guide. To extend the system, add tokens to `TallyTokens`, components to a new `variation-*.jsx`, and document them here.
