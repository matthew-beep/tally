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

  sun:      'var(--tally-sun)',  sunSoft:   'var(--tally-sun-soft)',  sunInk:   'var(--tally-sun-ink)',
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
  shadowFab:   '0 8px 20px rgba(242,192,74,0.5)',
  shadow:      'var(--tally-shadow-sm)',
} as const

export const F     = 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif'
export const FH    = 'var(--font-bricolage), "Bricolage Grotesque", system-ui, sans-serif'
export const FMONO = 'var(--font-jetbrains), "JetBrains Mono", monospace'

export const AVATAR_SLOTS = [
  { bg: T.sun,  fg: '#7A5200' },
  { bg: T.mint, fg: '#fff'   },
  { bg: T.coral,fg: '#fff'   },
  { bg: T.lav,  fg: '#fff'   },
] as const

export type DesignTokens = typeof T
