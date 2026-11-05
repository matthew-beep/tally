'use client'

import { T, FH } from '@/design/tokens'
import { CATEGORIES } from '@/lib/categories'
import { formatWholeDollars } from '@/lib/money'
import { ALL_TIME, monthShort, viewAmount, type CategorySpend, type MonthSpend, type SpendingPeriod, type SpendingView } from '@/lib/spending'

export type ChartKind = 'ring' | 'time'

/** A color belongs to its category, never its rank. */
export const CATEGORY_COLOR: Record<string, { fill: string }> = {
  '🏠': { fill: T.catHome },
  '🛒': { fill: T.catGroceries },
  '🍽️': { fill: T.catFood },
  '✈️': { fill: T.catTravel },
  '🚗': { fill: T.catTransport },
  '🎉': { fill: T.catEntertainment },
  '💸': { fill: T.catOther },
}

export function sharePercent(fraction: number): string {
  const p = fraction * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

const dim = (hovered: string | null, emoji: string) => (hovered && hovered !== emoji ? 0.28 : 1)
const describe = (c: CategorySpend) => `${c.label}, ${formatWholeDollars(c.amount)}, ${sharePercent(c.fraction)}`

function hoverProps(emoji: string, onHover: (emoji: string | null) => void) {
  return { onMouseEnter: () => onHover(emoji), onMouseLeave: () => onHover(null) }
}

/**
 * Fixed height, so switching charts doesn't move the list below. Flat tier: a
 * chart is information you read. Recessed means somewhere you put a value.
 */
export function ChartWell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height: 252, borderRadius: T.r.lg, boxShadow: T.shadowHair, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

export function RingChart({ categories, amount, caption, hovered, onHover, onOpenCategory }: {
  categories: CategorySpend[]
  amount: number
  caption: string
  hovered: string | null
  onHover: (emoji: string | null) => void
  onOpenCategory: (emoji: string) => void
}) {
  const R0 = 86, R1 = 58, C = 92, GAP = 0.014
  const point = (r: number, t: number) => `${(C + r * Math.cos(t)).toFixed(2)},${(C + r * Math.sin(t)).toFixed(2)}`
  const shown = categories.filter(c => c.amount > 0)
  let angle = -Math.PI / 2

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 184px) minmax(148px, 1fr)', gap: 18, alignItems: 'center', padding: '14px 18px 14px 12px' }}>
      {/* The ring gives way on narrow screens so category names stay whole. */}
      <svg viewBox="0 0 184 184" style={{ display: 'block', width: '100%', height: 'auto' }}>
        {shown.map(c => {
          const sweep = c.fraction * Math.PI * 2
          const a0 = angle + GAP
          const a1 = angle + sweep - GAP
          angle += sweep
          if (a1 <= a0) return null
          const big = a1 - a0 > Math.PI ? 1 : 0
          return (
            <path
              key={c.emoji}
              role="button"
              aria-label={describe(c)}
              onClick={() => onOpenCategory(c.emoji)}
              {...hoverProps(c.emoji, onHover)}
              d={`M${point(R0, a0)} A${R0},${R0} 0 ${big} 1 ${point(R0, a1)} L${point(R1, a1)} A${R1},${R1} 0 ${big} 0 ${point(R1, a0)}Z`}
              style={{ fill: CATEGORY_COLOR[c.emoji].fill, opacity: dim(hovered, c.emoji), cursor: 'pointer', transition: 'opacity .15s ease' }}
            >
              <title>{describe(c)}</title>
            </path>
          )
        })}
        <text x="92" y="96" textAnchor="middle" style={{ fill: T.ink, fontFamily: FH, fontSize: 23, fontWeight: 700 }}>{formatWholeDollars(amount)}</text>
        <text x="92" y="114" textAnchor="middle" style={{ fill: T.inkFaint, fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' }}>{caption}</text>
      </svg>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {shown.map(c => (
          <span key={c.emoji} {...hoverProps(c.emoji, onHover)} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.inkMuted, opacity: dim(hovered, c.emoji), transition: 'opacity .15s ease' }}>
            <i style={{ width: 9, height: 9, borderRadius: 3, flexShrink: 0, background: CATEGORY_COLOR[c.emoji].fill }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            <b style={{ marginLeft: 'auto', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{sharePercent(c.fraction)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * One column per month, stacked by category. In the whole-group view each
 * category also divides into your share and the faded remainder, which is why
 * the key below it exists; in your-share view there's only one layer.
 */
export function OverTimeChart({ months, period, view, solo = false, capLines = {}, hovered, onHover, onPickMonth }: {
  months: MonthSpend[]
  period: SpendingPeriod
  view: SpendingView
  /** One person in the group, so there are no shares to tell apart. */
  solo?: boolean
  /** Month → that month's budget, drawn as a dashed line across its bar. */
  capLines?: Record<string, number>
  hovered: string | null
  onHover: (emoji: string | null) => void
  onPickMonth: (month: string) => void
}) {
  const showShares = view === 'group' && !solo
  const hasLines = months.some(m => capLines[m.month])
  const barSpace = showShares || hasLines ? 146 : 164
  const max = Math.max(0, ...months.map(m => viewAmount(m, view)), ...months.map(m => capLines[m.month] ?? 0))
  // Largest overall sits on the baseline, in every month, so segments line up.
  const order = CATEGORIES
    .map(c => ({ emoji: c.emoji, label: c.label, amount: months.reduce((s, m) => s + viewAmount(m.byCategory[c.emoji], view), 0) }))
    .sort((a, b) => a.amount - b.amount)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '14px 14px 10px' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: 8, alignItems: 'end' }}>
        {months.map(m => {
          const selected = period === ALL_TIME || period === m.month
          const amount = viewAmount(m, view)
          const cap = capLines[m.month] ?? 0
          const barHeight = max > 0 ? (amount / max) * barSpace : 0
          const lineHeight = max > 0 ? (cap / max) * barSpace : 0
          return (
            <button
              key={m.month}
              type="button"
              aria-label={`${monthShort(m.month)}, ${formatWholeDollars(amount)}${cap ? `, budget ${formatWholeDollars(cap)}` : ''}`}
              aria-pressed={period === m.month}
              onClick={() => onPickMonth(m.month)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%', minWidth: 0, padding: '2px 0', border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 800, color: selected ? T.inkMuted : T.inkFaint, fontVariantNumeric: 'tabular-nums' }}>
                {amount > 0 ? formatWholeDollars(amount) : '—'}
              </span>
              <span style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: Math.max(barHeight, lineHeight) }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: 44, height: barHeight, borderRadius: '7px 7px 4px 4px', overflow: 'hidden', opacity: selected ? 1 : 0.4 }}>
                {order.map(c => {
                  const spend = m.byCategory[c.emoji]
                  if (!spend) return null
                  const others = spend.total - spend.yourShare
                  const fill = CATEGORY_COLOR[c.emoji].fill
                  const segment = { display: 'block', flexBasis: 0, minHeight: 1, background: fill, transition: 'opacity .15s ease' } as const
                  return (
                    <span key={c.emoji} {...hoverProps(c.emoji, onHover)} title={`${c.label}, ${formatWholeDollars(viewAmount(spend, view))}`} style={{ display: 'contents' }}>
                      {view === 'group' && others > 0 && <i style={{ ...segment, flexGrow: others, opacity: 0.3 * dim(hovered, c.emoji) }} />}
                      {spend.yourShare > 0 && <i style={{ ...segment, flexGrow: spend.yourShare, opacity: dim(hovered, c.emoji) }} />}
                    </span>
                  )
                })}
              </span>
              {cap > 0 && <i aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: lineHeight, borderTop: `2px dashed ${T.ink}`, opacity: 0.55 }} />}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: selected ? T.ink : T.inkFaint }}>{monthShort(m.month)}</span>
            </button>
          )
        })}
      </div>
      {(showShares || hasLines) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>
          {showShares && (
            <>
              <span><i style={{ display: 'inline-block', width: 12, height: 9, borderRadius: 2, marginRight: 6, background: T.inkMuted }} />Your share</span>
              <span><i style={{ display: 'inline-block', width: 12, height: 9, borderRadius: 2, marginRight: 6, background: T.inkMuted, opacity: 0.3 }} />Others&rsquo; share</span>
            </>
          )}
          {hasLines && <span><i style={{ display: 'inline-block', width: 14, height: 0, marginRight: 6, borderTop: `2px dashed ${T.ink}`, opacity: 0.55, verticalAlign: 3 }} />Budget</span>}
        </div>
      )}
    </div>
  )
}
