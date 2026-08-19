export const T = {
  bg:         'var(--tally-bg)',
  surface:    'var(--tally-surface)',
  surfaceAlt: 'var(--tally-surface-alt)',
  surfaceHov: 'var(--tally-surface-hov)',
  ink:        'var(--tally-ink)',
  inkMuted:   'var(--tally-ink-muted)',
  inkFaint:   'var(--tally-ink-faint)',
  line:       'var(--tally-line)',
  lineStrong: 'var(--tally-line-strong)',
  grayFill:   'var(--tally-gray-fill)',
  sidebarBg:  'var(--tally-sidebar-bg)',
  sidebarNavInk:    'var(--tally-sidebar-nav-ink)',
  sidebarHeaderInk: 'var(--tally-sidebar-header-ink)',
  sidebarGroupInk:  'var(--tally-sidebar-group-ink)',
  sidebarActiveInk:  'var(--tally-sidebar-active-ink)',
  sidebarActiveSoft: 'var(--tally-sidebar-active-soft)',

  sun:      'var(--tally-sun)',  sunSoft:   'var(--tally-sun-soft)',  sunInk:   'var(--tally-sun-ink)',
  sunOn:    'var(--tally-sun-on)',
  mint:     'var(--tally-mint)', mintSoft:  'var(--tally-mint-soft)', mintInk:  'var(--tally-mint-ink)',
  coral:    'var(--tally-coral)',coralSoft: 'var(--tally-coral-soft)',coralInk: 'var(--tally-coral-ink)',
  lav:      'var(--tally-lav)', lavSoft:   'var(--tally-lav-soft)', lavInk:   'var(--tally-lav-ink)',

  r: {
    tag:   6,
    sm:    8,
    md:    12,
    card:  14,
    tab:   16,
    lg:    18,
    panel: 20,
    xl:    22,
    sheet: 28,
    pill:  999,
  },

  shadowSm:    'var(--tally-shadow-sm)',
  shadowFloat: 'var(--tally-shadow-float)',
  shadowModal: 'var(--tally-shadow-modal)',
  shadow:      'var(--tally-shadow-sm)',

  cardBg:     'var(--tally-card-bg)',
  cardBorder: 'var(--tally-card-border)',
  cardShadow: 'var(--tally-card-shadow)',

  // Tactile depth — raised object (rest / hover-lift / press-sink)
  shadowRaised:      'var(--tally-shadow-raised)',
  shadowRaisedHover: 'var(--tally-shadow-raised-hover)',
  shadowPressed:     'var(--tally-shadow-pressed)',
  sunHi:             'var(--tally-sun-hi)',
  sunLo:             'var(--tally-sun-lo)',
  shadowSun:         'var(--tally-shadow-sun)',
  shadowSunHover:    'var(--tally-shadow-sun-hover)',
  shadowSunPressed:  'var(--tally-shadow-sun-pressed)',

  // Tactile depth — recessed trough (inputs) + the flat information tier
  sink:            'var(--tally-sink)',
  shadowRecessed:  'var(--tally-shadow-recessed)',
  shadowHair:      'var(--tally-shadow-hair)',
  focusRim:        'var(--tally-focus-rim)',
  shadowNone:      'var(--tally-shadow-none)',
} as const

/**
 * RECESSED input well — a trough pressed into the surface, which is what the
 * tactile language uses to say "put a value here".
 *
 * The rim layer is always present (transparent when idle) so focus eases in:
 * box-shadow only animates between lists of equal length. Pass `rimColor` to
 * show validation state instead of the sun focus rim.
 */
export function well(focused = false, rimColor?: string) {
  const rim = rimColor ?? (focused ? 'var(--tally-sun)' : 'transparent')
  return {
    background: T.sink,
    border: 0,
    boxShadow: `${T.shadowRecessed}, inset 0 0 0 1.5px ${rim}`,
    transition: 'box-shadow .15s ease',
  }
}

export const PADDING_X_BASE = 28
export const CONTENT_MAX_WIDTH = 680

export const F     = 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif'
export const FH    = 'var(--font-bricolage), "Bricolage Grotesque", system-ui, sans-serif'
export const FMONO = 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif'

export const AVATAR_SLOTS = [
  { bg: T.sun,  fg: '#7A5200' },
  { bg: T.mint, fg: '#fff'   },
  { bg: T.coral,fg: '#fff'   },
  { bg: T.lav,  fg: '#fff'   },
] as const

export type DesignTokens = typeof T
