# Design system — tokens

Single source of truth for color tokens is `src/app/globals.css` (CSS custom
properties, consumed via `src/design/tokens.ts`'s `T` object). This doc
records the *palette history* so a scheme can be restored or compared without
digging through git blame.

Light mode has not changed since launch. Dark mode has had two schemes:

1. **Void** (shipped first, through 2026-08-13) — OLED black, maximum contrast.
2. **Warm charcoal** (current, from the `Header & Sidebar Variants` design
   pass) — same warm-cream personality as light mode, carried into a dark
   base instead of neutral black.

Toggle lives in `src/lib/theme.ts` (`useTheme()`), applied via
`document.documentElement.setAttribute('data-theme', 'dark')`. Both schemes
below are drop-in replacements for the `[data-theme="dark"]` block in
`src/app/globals.css` — same variable names, only values differ.

## Light (unchanged)

```css
--tally-bg:          #F4EEE3;
--tally-surface:     #FFFFFF;
--tally-surface-alt: #F1EDE4;
--tally-surface-hov: #F5F1E9;
--tally-ink:         #1F1A14;
--tally-ink-muted:   rgba(31,26,20,0.52);
--tally-ink-faint:   rgba(31,26,20,0.28);
--tally-line:        rgba(31,26,20,0.07);
--tally-line-strong: rgba(31,26,20,0.16);
--tally-sidebar-bg:  rgba(31,26,20,0.02);

--tally-sun:         #F2C144; --tally-sun-soft:   #FDF4D0; --tally-sun-ink:   #7A5200;
--tally-mint:        #2DB97A; --tally-mint-soft:  #D3F5E5; --tally-mint-ink:  #0A5C35;
--tally-coral:       #EF6144; --tally-coral-soft: #FCEAE7; --tally-coral-ink: #862412;
--tally-lav:         #9179EF; --tally-lav-soft:   #EDE9FD; --tally-lav-ink:   #3C2BA8;

--tally-card-bg:     #FFFFFF;
--tally-card-border: none;
--tally-card-shadow: 0 2px 16px rgba(31,26,20,0.10), 0 1px 3px rgba(31,26,20,0.06);

--tally-shadow-sm:    0 1px 0 rgba(31,26,20,0.04);
--tally-shadow-float: 0 8px 24px rgba(0,0,0,0.08);
--tally-shadow-modal: 0 30px 80px rgba(0,0,0,0.28);
--tally-skeleton-a:   rgba(31,26,20,0.06);
--tally-skeleton-b:   rgba(31,26,20,0.10);

--tally-page-bg: #F4EEE3;
```

## Dark — "Void" (archived 2026-08-13)

OLED black base, tuned for maximum contrast / true-black displays. Replaced
because it read as generic dark-mode-gray rather than a dark version of
Tally's warm cream identity. Kept here in case OLED-contrast is wanted again
(e.g. a future "Void" alternate theme, not just for restore-on-regret).

```css
--tally-bg:          #0C0C0C;
--tally-surface:     #191919;
--tally-surface-alt: #252525;
--tally-surface-hov: #2E2E2E;
--tally-ink:         #F2F2F2;
--tally-ink-muted:   rgba(242,242,242,0.62);
--tally-ink-faint:   rgba(242,242,242,0.38);
--tally-line:        rgba(255,255,255,0.07);
--tally-line-strong: rgba(255,255,255,0.13);
--tally-sidebar-bg:  rgba(255,255,255,0.015);
--tally-shadow-sm:    0 1px 0 rgba(0,0,0,0.4);
--tally-shadow-float: 0 8px 24px rgba(0,0,0,0.55);
--tally-shadow-modal: 0 30px 80px rgba(0,0,0,0.75);
--tally-skeleton-a:   rgba(242,242,242,0.05);
--tally-skeleton-b:   rgba(242,242,242,0.09);

--tally-sun:         #F5CB66; --tally-sun-soft:   rgba(245,203,102,0.16); --tally-sun-ink:   #FAE7B0;
--tally-mint:        #6FD2B0; --tally-mint-soft:  rgba(111,210,176,0.14); --tally-mint-ink:  #9FE6CB;
--tally-coral:       #F2A48A; --tally-coral-soft: rgba(242,164,138,0.14); --tally-coral-ink: #F7BBA6;
--tally-lav:         #C3B6EB; --tally-lav-soft:   rgba(195,182,235,0.13); --tally-lav-ink:   #C3B6EB;

--tally-card-bg:     #272727;
--tally-card-border: 0.5px solid rgba(255,255,255,0.10);
--tally-card-shadow: 0 4px 18px rgba(0,0,0,0.55);

--tally-page-bg: #0C0C0C;
```

`theme-color` meta / status bar tint for Void was `#0C0C0C`.

## Dark — "Warm charcoal" (current, since 2026-08-13)

From the Claude Design project *"Header & Sidebar Variants"* (`tally-shared.jsx`
→ `TallyTokens.dark`): "warm charcoal, not black — layered surfaces
(`#181410` page → `#231D17` surface → `#2B241D` elevated) keep the cream
personality." Accent hues (sun/mint/coral/lav) are unchanged from Void — only
the neutral bg/surface/ink layers moved from gray-black to a brown-black that
echoes the light theme's cream (`#F4EEE3`) instead of contrasting against it.

`surface-alt`, `surface-hov`, and `card-bg` aren't given directly by the
3-tier mockup (`bg` → `surface` → `elevated`); they're interpolated to
preserve the same relative-elevation steps Void used (`surface-alt` sits
between `surface` and the mockup's "elevated" tone, which became `card-bg`;
`surface-hov` extrapolates one more step up for hover states).

```css
--tally-bg:          #181410;
--tally-surface:     #231D17;
--tally-surface-alt: #262019;
--tally-surface-hov: #2F2820;
--tally-ink:         #F4EEE3;
--tally-ink-muted:   rgba(244,238,227,0.62);
--tally-ink-faint:   rgba(244,238,227,0.38);
--tally-line:        rgba(244,238,227,0.08);
--tally-line-strong: rgba(244,238,227,0.16);
--tally-sidebar-bg:  rgba(244,238,227,0.015);
--tally-shadow-sm:    0 1px 0 rgba(0,0,0,0.4);
--tally-shadow-float: 0 8px 24px rgba(0,0,0,0.55);
--tally-shadow-modal: 0 30px 80px rgba(0,0,0,0.75);
--tally-skeleton-a:   rgba(244,238,227,0.05);
--tally-skeleton-b:   rgba(244,238,227,0.09);

--tally-sun:         #F5CB66; --tally-sun-soft:   rgba(245,203,102,0.20); --tally-sun-ink:   #FAE7B0;
--tally-mint:        #6FD2B0; --tally-mint-soft:  rgba(111,210,176,0.18); --tally-mint-ink:  #9FE6CB;
--tally-coral:       #F2A48A; --tally-coral-soft: rgba(242,164,138,0.18); --tally-coral-ink: #F7BBA6;
--tally-lav:         #C3B6EB; --tally-lav-soft:   rgba(195,182,235,0.18); --tally-lav-ink:   #F0EAFB;

--tally-card-bg:     #2B241D;
--tally-card-border: 0.5px solid rgba(244,238,227,0.10);
--tally-card-shadow: 0 4px 18px rgba(0,0,0,0.55);

--tally-page-bg: #181410;
```

`theme-color` meta / status bar tint is `#181410`.

Note: `--tally-lav-ink` was `#C3B6EB` (identical to `--tally-lav`) in Void —
almost certainly a copy-paste placeholder rather than an intentional choice,
since every other dark accent pair uses a lighter "-ink" tone than its base
color. Warm charcoal picks `#F0EAFB` (lightened lavender, consistent with how
`sun-ink`/`mint-ink`/`coral-ink` relate to their base colors) rather than
carrying the placeholder forward.

## `sun-ink` vs `sun-on` — two different jobs, split 2026-08-14/15

`--tally-sun-ink` (`T.sunInk`) is theme-adaptive, like every other `-ink`
token: `#7A5200` in light, lightened to `#FAE7B0` in dark. It's for text/icons
tinted *against* a translucent `sun-soft` fill — the avatar-slot convention in
`CLAUDE.md` ("Slot 1 / You: Sun bg, sunInk text") and similar low-contrast
sun-tinted contexts, where lightening the ink in dark mode is correct because
the background it sits on also lightens.

That breaks for text/icons on a **solid** `T.sun` swatch — CTA buttons
(`Btn.tsx` primary), the add-expense FAB (`DockedTabBar.tsx`), the app header
action button, the mobile tab bar's add button, `NotificationBell`. `T.sun`
itself stays a saturated gold in both themes (`#F2C144` light / `#F5CB66`
dark) — it does not lighten the way `sun-soft` does — so `sunInk`'s dark-mode
value (`#FAE7B0`, near-white) landed near-white text on near-gold, a contrast
regression that didn't exist in light mode (where both tokens happened to be
the same value).

Fix: `--tally-sun-on` (`T.sunOn`), fixed at `#7A5200` in **both** themes —
declared identically in `:root` and `[data-theme="dark"]`, no adaptation, by
design. Rule of thumb: `sunInk` for text tinted against `sun-soft`, `sunOn`
for text/icons sitting directly on solid `T.sun`. Several files use both
(e.g. `add-expense/DesktopPanel.tsx`, `home/BalanceSheet.tsx`,
`groups/new/page.tsx`) for exactly these two different purposes — that's
correct, not drift.

**Known gap:** `sun-on` was added to `src/app/globals.css`'s CSS-variable
blocks (`:root` / `[data-theme="dark"]`) but not to the `@theme` block lower
in the same file that mirrors these as Tailwind utilities
(`--color-tally-sun-ink` has no `--color-tally-sun-on` counterpart). Not
currently load-bearing — every consumer reads `T.sunOn` via CSS-in-JS, none
go through a Tailwind class — but add it there too if a `text-tally-sun-on`
utility class is ever reached for.

## Tactile depth — four tiers (2026-08-19)

From the `Tactile Concepts` design pass. Depth carries meaning rather than
decoration, and every shadow is built from warm ink — never gray, never gloss.

| Tier | Means | Recipe |
|---|---|---|
| **Flat** | information you read | `--tally-shadow-hair` |
| **Recessed** | somewhere you put a value | `--tally-sink` + `--tally-shadow-recessed` |
| **Raised** | something you can act on | `--tally-shadow-raised` (`-hover`, `-pressed`) |
| **Floating** | modal, popover, sidebar | `--tally-shadow-float` |

Sun is the only accent, and the guide's rule is *one raised sun object per
view* — that's why the segmented control's selected segment is a raised
warm-white insert rather than sun (the primary action owns the sun).

**Components that own a tier**, so call sites don't re-implement it:

- `Btn` — raised; `primary` carries the sun gradient + `--tally-shadow-sun`.
- `Token` / `PersonToken` (`components/PersonToken.tsx`) — the one selectable
  pill shape. Renders **flat when it has no `onClick`**: a pill you can only
  read is information.
- `Segmented` — recessed track, raised insert.
- `Input` — recessed well + the borderless field, sizes
  `hero | title | md | cellLg | cell`.
- `well(focused, rimColor)` (`design/tokens.ts`) — the recessed primitive, for
  inputs whose well holds more than a value (`MemberCombobox`'s chips,
  `HandleInput`'s validation pip) and for segmented-style tracks.

### Two animation traps

Both cause a visible *snap* instead of an ease, and both were live bugs:

1. **`box-shadow` only interpolates between lists of equal length.** The
   pressed recipes carry two trailing transparent layers purely to match
   raised/sun's four. `--tally-shadow-none` exists as a 4-layer no-op for the
   same reason. Don't "tidy" these away.
2. **A gradient can't interpolate to a flat color.** `Btn`'s pressed sun and
   `Token`'s unselected fill are both gradients for this reason, even where a
   solid would look identical at rest.

`well()` applies the same rule: the focus rim layer is always present,
transparent when idle.

### Floating tier — retuned 2026-08-19

`--tally-shadow-float` was `0 8px 24px rgba(0,0,0,0.08)` — a neutral gray
shadow, which the guide forbids outright. Now warm-tinted with the hairline
ring the recipe calls for:

```
0 10px 34px rgba(31,26,20,0.12), inset 0 0 0 1px rgba(31,26,20,0.05)
```

Shared, so it lands on every genuinely floating surface at once: the sidebar
panel, `TabBar`, `Toast`, `DatePicker`, `EmojiPopover`, the `MemberCombobox`
dropdown, `ProfileMenuPopover` (which was hand-appending the ring — removed,
the recipe includes it now).

**`T.shadowFab` was deleted.** It was the only entry in `tokens.ts` holding a
literal instead of a `var()`, and therefore the only one that couldn't respond
to the theme — it painted a yellow halo on warm charcoal in dark mode. The FAB
(`DockedTabBar`) and the active nav pill (`SliderPill`) now use the sun
gradient + `--tally-shadow-sun` like every other sun object.

### Open decision — flat information cards

**Unresolved as of 2026-08-19.** The guide says *"keep info cards flat so depth
stays meaningful"*, but `Card`'s `elevated` tone (white fill + drop shadow) is
used on nearly every read-only surface, so today the whole app reads as
actionable.

`Card` has an opt-in `tone="flat"` and **nothing uses it yet**. Compare at
`/devpreviewxyz/tactile-cards` (scratch route, delete before shipping).

What makes it a real decision, not a cleanup:

- Flat is `background: transparent` — on cream, an info card loses its white
  fill entirely and becomes a hairline rectangle. The app sheds most of its
  white; white becomes the material of touchable things.
- Since the sidebar became a floating panel, desktop has two competing white
  systems (nav panel + content cards) at similar elevation. Flattening the
  content resolves that — arguably the strongest argument for it.
- A **third option** nobody has evaluated: keep the white fill, drop the
  shadow (`cardBg` + `shadowHair`). Separation without elevation.

Scope if adopted: `Card.tsx:24` already computes `actionable = !!(onClick ||
hoverable)`, so it's one branch, not an audit. Bespoke card surfaces that
inline `T.cardShadow` need doing by hand — home balance hero
(`(dashboard)/page.tsx:119`), all-square empty state (`:160`), desktop people
ledger (`:268`). Also folds in `FeedCard`, which sets `tone="surface"`
unconditionally while being only *conditionally* clickable
(`FeedCard.tsx:42`), so tappable and dead feed rows look identical today.

## Fonts

Two fonts as of 2026-08-13, down from three. `src/design/tokens.ts` exports
`F`, `FH`, `FMONO`; loaded in `src/app/layout.tsx` via `next/font/google`.

| Token | Font | Role |
|---|---|---|
| `FH` | Bricolage Grotesque | Branding only — app name, headings, monetary amount hero digits |
| `F` | Plus Jakarta Sans | Everything else — labels, body, buttons, inputs |
| `FMONO` | Plus Jakarta Sans | Was JetBrains Mono (tabular figures: cents, metadata captions). `.font-mono` still applies `font-variant-numeric: tabular-nums` for column alignment — only the typeface changed, not the alignment behavior. |

JetBrains Mono's `next/font/google` load and `--font-jetbrains` CSS variable
were removed entirely, not just unreferenced — it's fully gone from the
bundle.
