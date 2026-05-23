export const T = {
  bg:         '#F4EEE3',
  surface:    '#FFFFFF',
  surfaceAlt: '#F1EDE4',
  surfaceHov: '#F5F1E9',
  ink:        '#1F1A14',
  inkMuted:   'rgba(31,26,20,0.52)',
  inkFaint:   'rgba(31,26,20,0.28)',
  line:       'rgba(31,26,20,0.07)',
  lineStrong: 'rgba(31,26,20,0.16)',

  sun:      '#F2C144', sunSoft:   '#FDF4D0', sunInk:   '#7A5200',
  mint:     '#2DB97A', mintSoft:  '#D3F5E5', mintInk:  '#0A5C35',
  coral:    '#EF6144', coralSoft: '#FCEAE7', coralInk: '#862412',
  lav:      '#9179EF', lavSoft:   '#EDE9FD', lavInk:   '#3C2BA8',

  r: {
    tag:   6,   // inline tags
    sm:    8,   // icon buttons
    md:    12,  // small buttons, inputs
    card:  14,  // medium cards
    tab:   16,  // tab bar, large buttons
    lg:    18,  // list cards
    panel: 20,  // panel cards
    xl:    22,  // hero cards, tab bar track
    sheet: 28,  // bottom sheet top corners
    pill:  999, // pills, circular
  },

  // Elevation — §5
  shadowSm:    '0 1px 0 rgba(31,26,20,0.04)',         // lifted: default card on cream
  shadowFloat: '0 8px 24px rgba(0,0,0,0.08)',          // floating: tab bar, sticky panels
  shadowModal: '0 30px 80px rgba(0,0,0,0.28)',         // modal: sheets over content
  shadowFab:   '0 8px 20px rgba(242,192,74,0.5)',      // FAB glow

  // Keep for backwards compat, maps to lifted shadow
  shadow: '0 1px 0 rgba(31,26,20,0.04)',
} as const

export const F     = 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif'
export const FH    = 'var(--font-bricolage), "Bricolage Grotesque", system-ui, sans-serif'
export const FMONO = 'var(--font-jetbrains), "JetBrains Mono", monospace'

export const AVATAR_SLOTS = [
  { bg: T.sun,  fg: T.sunInk },
  { bg: T.mint, fg: '#fff'   },
  { bg: T.coral,fg: '#fff'   },
  { bg: T.lav,  fg: '#fff'   },
] as const

export type DesignTokens = typeof T
