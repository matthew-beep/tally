'use client'

import { T, F } from '@/design/tokens'
import { formatDollars } from '@/lib/money'
import { calcSpending, currentMonth, monthName, monthShort } from '@/lib/spending'
import type { Expense } from '@/types'
import { CATEGORY_COLOR } from './SpendingCharts'

interface Props {
  expenses: Expense[]
  onOpen: () => void
}

/** One line above the group's feed, always about this month. Opens SpendingSheet. */
export function SpendingBanner({ expenses, onOpen }: Props) {
  if (expenses.length === 0) return null

  const thisMonth = currentMonth()
  const { amount, categories } = calcSpending(expenses, thisMonth)
  const month = monthName(thisMonth)
  const top = categories[0]

  return (
    <button
      type="button"
      className="tactile-raised"
      onClick={onOpen}
      style={{ width: '100%', minHeight: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px', border: 0, borderRadius: T.r.lg, fontFamily: F, textAlign: 'left' }}
    >
      <span aria-hidden style={{ fontSize: 18, flexShrink: 0 }}>📊</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.inkMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {top ? (
          <>
            <b style={{ color: T.ink, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatDollars(amount)}</b>
            <span className="spending-banner-long">{` spent in ${month} so far · mostly `}</span>
            <span className="spending-banner-short">{` in ${monthShort(thisMonth)} · mostly `}</span>
            <i aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', margin: '0 5px 1px 1px', background: CATEGORY_COLOR[top.emoji].fill }} />
            <span style={{ color: T.ink, fontWeight: 700 }}>{top.label}</span>
          </>
        ) : (
          `Nothing spent yet in ${month}`
        )}
      </span>
      <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 13px', borderRadius: T.r.md, background: T.surfaceAlt, color: T.inkMuted, fontSize: 13, fontWeight: 700 }}>
        <span className="spending-banner-long">View breakdown</span>
        <svg aria-hidden width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1 1l4.5 4.5L1 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </button>
  )
}
