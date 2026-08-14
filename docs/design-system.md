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
