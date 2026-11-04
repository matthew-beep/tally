'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Token } from '@/components/PersonToken'
import { formatWholeDollars } from '@/lib/money'
import { currentMonth, monthLabel, monthRange, monthShort, monthsBetween, shiftMonth, type MonthBounds } from '@/lib/spending'

interface Props {
  /** The month shown, also where the arrows land when leaving all time. */
  month: string
  isAll: boolean
  bounds: MonthBounds
  /** What the current view counts, for every month in `bounds`. */
  amounts: { month: string; amount: number }[]
  hint: string
  today: string
  onMonth: (month: string) => void
  onAllTime: (on: boolean) => void
}

const arrowStyle = (disabled: boolean): CSSProperties => ({
  width: 34, height: 34, flexShrink: 0, border: 0, borderRadius: 9, background: 'transparent', color: T.inkMuted,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.28 : 1,
})

function Arrow({ dir, disabled, label, onClick }: { dir: -1 | 1; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="tactile-ghost" aria-label={label} disabled={disabled} onClick={onClick} style={arrowStyle(disabled)}>
      <svg aria-hidden width="7" height="11" viewBox="0 0 7 11" fill="none">
        <path d={dir < 0 ? 'M6 1L1.5 5.5 6 10' : 'M1 1l4.5 4.5L1 10'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/**
 * ‹ November 2026 › with a separate All time button. The label opens a year of
 * months, each with its spend; left and right arrow keys step between them.
 *
 * The panel opens in the page flow rather than as a floating popover: the side
 * panel and the mobile sheet are both transformed, which breaks `position:
 * fixed` inside them, and their scrollers would clip an absolute one. `order`
 * drops it below the row, so the caller renders this in a wrapping flex row.
 */
export function MonthPicker({ month, isAll, bounds, amounts, hint, today, onMonth, onAllTime }: Props) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const selectedRef = useRef<HTMLButtonElement>(null)
  const labelRef = useRef<HTMLButtonElement>(null)

  const firstYear = Number(bounds.first.slice(0, 4))
  const lastYear = Number(bounds.last.slice(0, 4))
  const now = currentMonth(today)
  const totals = new Map(amounts.map(a => [a.month, a.amount]))
  const max = Math.max(0, ...amounts.map(a => a.amount))
  const allTotal = amounts.reduce((s, a) => s + a.amount, 0)
  const canGoBack = isAll || month > bounds.first
  const canGoForward = isAll || month < bounds.last

  useEffect(() => {
    if (open) selectedRef.current?.focus()
  }, [open])

  function step(by: -1 | 1) {
    if (isAll) onAllTime(false)
    else onMonth(shiftMonth(month, by))
  }

  function close() {
    setOpen(false)
    labelRef.current?.focus()
  }

  function onBarKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' && canGoBack) { e.preventDefault(); step(-1) }
    if (e.key === 'ArrowRight' && canGoForward) { e.preventDefault(); step(1) }
  }

  // Stops here so Escape closes the picker rather than the whole panel.
  function onPanelKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); close() }
  }

  return (
    <>
      <div
        role="group"
        aria-label="Month"
        onKeyDown={onBarKey}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: T.r.md, background: T.sink, boxShadow: T.shadowRecessed }}
      >
        <Arrow dir={-1} label="Previous month" disabled={!canGoBack} onClick={() => step(-1)} />
        <button
          ref={labelRef}
          type="button"
          className="tactile-ghost"
          aria-expanded={open}
          onClick={() => { setYear(Number(month.slice(0, 4))); setOpen(o => !o) }}
          style={{ flex: 1, minWidth: 0, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 9, background: 'transparent', boxShadow: open ? `inset 0 0 0 1.5px ${T.sun}` : 'none', color: T.ink, cursor: 'pointer', fontFamily: FH, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          {isAll ? monthRange(bounds.first, bounds.last) : monthLabel(month)}
          <svg aria-hidden width="9" height="6" viewBox="0 0 9 6" fill="none"><path d="M1 1l3.5 3.5L8 1" stroke={T.inkFaint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <Arrow dir={1} label="Next month" disabled={!canGoForward} onClick={() => step(1)} />
      </div>

      <Token selected={isAll} onClick={() => onAllTime(!isAll)}>All time</Token>

      {open && (
        <div onKeyDown={onPanelKey} style={{ order: 1, flexBasis: '100%', padding: 12, borderRadius: T.r.lg, background: T.surfaceAlt, boxShadow: T.shadowHair, fontFamily: F }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Arrow dir={-1} label="Previous year" disabled={year <= firstYear} onClick={() => setYear(y => y - 1)} />
              <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{year}</span>
              <Arrow dir={1} label="Next year" disabled={year >= lastYear} onClick={() => setYear(y => y + 1)} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>{hint}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            {monthsBetween(`${year}-01`, `${year}-12`).map(m => {
              const enabled = m >= bounds.first && m <= bounds.last
              const on = !isAll && m === month
              const amount = totals.get(m) ?? 0
              return (
                <button
                  key={m}
                  ref={on ? selectedRef : undefined}
                  type="button"
                  className={enabled ? `tactile-raised${on ? ' tactile-raised--sun' : ''}` : undefined}
                  disabled={!enabled}
                  aria-label={enabled ? `${monthLabel(m)}, ${formatWholeDollars(amount)}` : monthLabel(m)}
                  aria-pressed={on}
                  onClick={() => { onMonth(m); close() }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '9px 4px 8px', border: 0, borderRadius: T.r.md, background: enabled ? undefined : 'transparent', color: on ? T.sunOn : T.ink, cursor: enabled ? undefined : 'default', fontFamily: F }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: on ? T.sunOn : enabled ? T.ink : T.inkFaint, opacity: enabled ? 1 : 0.55 }}>
                    {monthShort(m)}
                    {m === now && <em style={{ fontStyle: 'normal', fontSize: 9.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: on ? T.sunOn : T.sunInk }}>now</em>}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'flex-end', width: 22, height: 26 }}>
                    {enabled && amount > 0 && (
                      <i style={{ display: 'block', width: '100%', height: `${Math.max((amount / max) * 100, 8)}%`, borderRadius: '4px 4px 2px 2px', background: on ? T.sunOn : T.inkFaint, opacity: on ? 0.55 : 1 }} />
                    )}
                  </span>
                  <span style={{ minHeight: 14, fontSize: 11, fontWeight: 700, color: on ? T.sunOn : T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
                    {enabled ? formatWholeDollars(amount) : ''}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: T.inkFaint, lineHeight: 1.4 }}>
              Nothing before {monthLabel(bounds.first)}, the first expense.
            </span>
            <Token size="sm" selected={isAll} onClick={() => { onAllTime(true); close() }}>
              All time · {formatWholeDollars(allTotal)}
            </Token>
          </div>
        </div>
      )}
    </>
  )
}
