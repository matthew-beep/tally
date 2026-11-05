'use client'

import { T, FH } from '@/design/tokens'
import { Btn } from '@/components/Btn'
import { Card } from '@/components/Card'
import type { BudgetMonth } from '@/lib/budget'
import { formatWholeDollars } from '@/lib/money'
import { monthName, shiftMonth } from '@/lib/spending'

const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: T.inkFaint } as const

export function LockLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.inkFaint, whiteSpace: 'nowrap' }}>
      <svg aria-hidden width="11" height="12" viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="5" width="9" height="6.2" rx="1.8" /><path d="M3 5V3.6a2.5 2.5 0 015 0V5" /></svg>
      {children}
    </span>
  )
}

function Status({ state, month }: { state: BudgetMonth; month: string }) {
  const bold = (color: string, text: string) => <b style={{ fontWeight: 800, color }}>{text}</b>
  const { left, phase, over, perDay, daysLeft } = state

  if (left == null) {
    const n = state.limits.length
    return <>{n} category {n === 1 ? 'limit' : 'limits'}, no monthly total.</>
  }
  if (phase === 'current') {
    if (over) return <>{bold(T.coralInk, `${formatWholeDollars(-left)} past the budget.`)} Nothing breaks, and {monthName(shiftMonth(month, 1))} starts fresh.</>
    if (perDay != null) return <>About {bold(T.ink, `${formatWholeDollars(perDay)} a day`)} for the next {daysLeft} {daysLeft === 1 ? 'day' : 'days'}.</>
    return <>Last day of {monthName(month)}.</>
  }
  if (phase === 'past') {
    return over
      ? bold(T.coralInk, `Finished ${formatWholeDollars(-left)} over budget.`)
      : bold(T.mintInk, `Finished ${formatWholeDollars(left)} under budget.`)
  }
  return <>{monthName(month)} hasn&rsquo;t started yet.</>
}

/**
 * A month's budget, under its total. There's deliberately no pace marker: rent
 * lands on the 1st, so any judgment of pace would call a household behind for
 * most of the month. It says what's left and leaves it there.
 */
export function BudgetCard({ state, month, canEdit, onEdit }: {
  state: BudgetMonth
  month: string
  canEdit: boolean
  onEdit: () => void
}) {
  const { cap, left, over, fraction, spent, overLimits, phase } = state
  return (
    <Card tone="surface" style={{ padding: 16, borderRadius: T.r.lg, boxShadow: T.shadowHair }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 30 }}>
        <span style={eyebrow}>{monthName(month)} budget</span>
        {phase === 'current' && canEdit && <Btn variant="soft" size="sm" onClick={onEdit}>Edit</Btn>}
        {phase === 'past' && <LockLabel>Past month</LockLabel>}
      </div>

      {cap != null && left != null && fraction != null && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, fontSize: 13, fontWeight: 600, color: T.inkMuted }}>
            <span>{Math.round(fraction * 100)}% of {formatWholeDollars(cap)}</span>
            <b style={{ fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: over ? T.coralInk : T.ink }}>
              {over ? `${formatWholeDollars(-left)} over` : `${formatWholeDollars(left)} left`}
            </b>
          </div>
          <div
            role="progressbar"
            aria-label={`${formatWholeDollars(spent)} of ${formatWholeDollars(cap)} budget`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(Math.round(fraction * 100), 100)}
            style={{ height: 12, marginTop: 10, borderRadius: 7, background: T.surfaceAlt, overflow: 'hidden' }}
          >
            <i style={{ display: 'block', height: '100%', width: `${Math.min(fraction * 100, 100)}%`, borderRadius: 7, background: over ? T.coral : T.sun, transition: 'width .35s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
        </>
      )}

      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: T.inkMuted, textWrap: 'pretty' }}>
        <Status state={state} month={month} />
        {overLimits.length > 0 && ` Over its limit: ${overLimits.map(l => l.label).join(', ')}.`}
      </div>
    </Card>
  )
}

export function SetBudgetPrompt({ groupName, solo, onSet }: { groupName: string; solo: boolean; onSet: () => void }) {
  return (
    <Card tone="surface" style={{ padding: '18px 16px', borderRadius: T.r.lg, boxShadow: T.shadowHair }}>
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>
        Set a budget{solo ? '' : ' together'}
      </div>
      <p style={{ margin: '6px 0 14px', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: T.inkMuted, textWrap: 'pretty' }}>
        A monthly total, limits on the categories you care about, or both.{' '}
        {solo ? 'Only you can see it.' : `Everyone in ${groupName} can see it and change it.`}
      </p>
      <Btn variant="primary" size="md" onClick={onSet} style={{ padding: '10px 16px' }}>Set a budget</Btn>
    </Card>
  )
}
