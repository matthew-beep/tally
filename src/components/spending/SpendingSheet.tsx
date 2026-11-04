'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { Segmented } from '@/components/Segmented'
import { ModalHeader, SidePanelOrSheet } from '@/components/modal'
import { CATEGORIES } from '@/lib/categories'
import { formatDollars, formatWholeDollars, splitAmount } from '@/lib/money'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import {
  ALL_TIME, calcMemberShares, calcMonthContext, calcMonthly, calcSpending, chartMonths, currentMonth,
  monthName, monthRange, monthShort, monthsBetween, periodPhrase, spendingBounds, viewAmount,
  type CategorySpend, type MonthContext, type MonthSpend, type SpendingPeriod, type SpendingView,
} from '@/lib/spending'
import { localISODate } from '@/lib/time'
import type { Expense, GroupMember } from '@/types'
import { MonthPicker } from './MonthPicker'
import { CATEGORY_COLOR, ChartWell, OverTimeChart, RingChart, sharePercent, type ChartKind } from './SpendingCharts'

interface Props {
  open: boolean
  onClose: () => void
  expenses: Expense[]
  members: GroupMember[]
  myId?: string
}

const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: T.inkFaint } as const

/** "Oct 3", with the year once it isn't this one. Parsed by hand to avoid UTC drift. */
function shortDate(iso: string, today: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const sameYear = iso.slice(0, 4) === today.slice(0, 4)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function Hero({ label, amount, context }: { label: string; amount: number; context: MonthContext }) {
  const { whole, cents } = splitAmount(amount)
  return (
    <div style={{ margin: '6px 2px 2px' }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ marginTop: 8, fontFamily: FH, fontSize: 42, fontWeight: 700, letterSpacing: -1.6, lineHeight: 1, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ opacity: 0.5 }}>$</span>{whole}
        <span style={{ fontFamily: FMONO, fontSize: 20, fontWeight: 600, letterSpacing: 0, color: T.inkMuted }}>{cents}</span>
      </div>
      <div style={{ marginTop: 9, fontSize: 13, fontWeight: 600, color: T.inkMuted }}><ContextLine context={context} /></div>
    </div>
  )
}

function ContextLine({ context: c }: { context: MonthContext }) {
  switch (c.kind) {
    case 'allTime':
      return <>Across {c.months} {c.months === 1 ? 'month' : 'months'} · about {formatWholeDollars(c.average)} a month</>
    case 'inProgress':
      return <>Month in progress, day {c.day}{c.previous && ` · ${monthName(c.previous.month)} came to ${formatWholeDollars(c.previous.amount)}`}</>
    case 'first':
      return <>The first month on record</>
    case 'noPrevious':
      return <>Nothing spent in {monthName(c.previousMonth)}</>
    case 'same':
      return <>About the same as {monthName(c.previous.month)} ({formatWholeDollars(c.previous.amount)})</>
    case 'change':
      return (
        <>
          <b style={{ fontWeight: 800, color: c.percent < 0 ? T.mintInk : T.coralInk }}>{c.percent < 0 ? '−' : '+'}{Math.abs(c.percent)}%</b>
          {` vs ${monthName(c.previous.month)} (${formatWholeDollars(c.previous.amount)})`}
        </>
      )
  }
}

/**
 * Where a group's money went, for one month or all time: a total, a chart, and
 * a ranked list of categories that each open onto their expenses. Whole group
 * counts full expense amounts; Your share counts your split of each one,
 * whoever paid. Neither is a balance.
 */
export function SpendingSheet({ open, onClose, expenses, members, myId }: Props) {
  const today = localISODate()
  const [pickedMonth, setPickedMonth] = useState<string | null>(null)
  const [isAll, setIsAll] = useState(false)
  const [view, setView] = useState<SpendingView>('group')
  const [chart, setChart] = useState<ChartKind>('ring')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // Moving between the overview and a category starts at the top of the new view.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 })
  }, [selected])

  const month = pickedMonth ?? currentMonth(today)
  const period: SpendingPeriod = isAll ? ALL_TIME : month
  const bounds = useMemo(() => spendingBounds(expenses, today), [expenses, today])
  const summary = useMemo(() => calcSpending(expenses, period, view, myId), [expenses, period, view, myId])
  const allMonths = useMemo(() => calcMonthly(expenses, monthsBetween(bounds.first, bounds.last), myId), [expenses, bounds, myId])
  const recentMonths = useMemo(() => {
    const months = new Set(chartMonths(period, bounds))
    return allMonths.filter(m => months.has(m.month))
  }, [allMonths, period, bounds])

  const phrase = periodPhrase(period, bounds, today)
  const context = calcMonthContext(period, summary.amount, allMonths, view, bounds, today)
  const mine = view === 'mine'

  function handleClose() {
    setSelected(null)
    setPickedMonth(null)
    setIsAll(false)
    setHovered(null)
    onClose()
  }

  function openCategory(emoji: string) {
    setHovered(null)
    setSelected(emoji)
  }

  function pickMonth(next: string) {
    setPickedMonth(next)
    setIsAll(false)
  }

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <MonthPicker
        month={month}
        isAll={isAll}
        bounds={bounds}
        amounts={allMonths.map(m => ({ month: m.month, amount: viewAmount(m, view) }))}
        hint={mine ? 'Your share each month' : 'Spent each month'}
        today={today}
        onMonth={pickMonth}
        onAllTime={setIsAll}
      />
    </div>
  )

  return (
    <SidePanelOrSheet open={open} onClose={handleClose} title="Spending breakdown" width={480}>
      <ModalHeader title="Spending breakdown" onClose={handleClose} style={{ padding: '16px 16px 14px 24px', alignItems: 'center' }} />

      {/* max-content rows: anything shorter squeezes a clipping child, like the
          expense list, into the space left over instead of letting this scroll. */}
      <div ref={scrollerRef} className="spending-breakdown" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 22px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridAutoRows: 'max-content', alignContent: 'start', gap: 12, fontFamily: F, color: T.ink }}>
        {selected ? (
          <CategoryDetail
            emoji={selected}
            category={summary.categories.find(c => c.emoji === selected)}
            view={view}
            period={period}
            phrase={phrase}
            controls={controls}
            months={recentMonths}
            allMonths={allMonths}
            members={members}
            myId={myId}
            today={today}
            onPickMonth={pickMonth}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            {controls}

            {myId && (
              <Segmented
                fullWidth
                tone="sun"
                value={view}
                onChange={setView}
                options={[{ value: 'group', label: 'Whole group' }, { value: 'mine', label: 'Your share' }]}
              />
            )}

            <Hero label={`${mine ? 'Your share' : 'Total spent'} ${phrase}`} amount={summary.amount} context={context} />

            <Segmented
              fullWidth
              tone="sun"
              value={chart}
              onChange={setChart}
              options={[{ value: 'ring', label: 'Ring' }, { value: 'time', label: 'Over time' }]}
            />

            <ChartWell>
              {chart === 'time' ? (
                <OverTimeChart months={recentMonths} period={period} view={view} hovered={hovered} onHover={setHovered} onPickMonth={pickMonth} />
              ) : summary.amount > 0 ? (
                <RingChart
                  categories={summary.categories}
                  amount={summary.amount}
                  caption={mine ? 'your share' : 'total spent'}
                  hovered={hovered}
                  onHover={setHovered}
                  onOpenCategory={openCategory}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600, color: T.inkFaint }}>
                  Nothing spent {phrase}.
                </div>
              )}
            </ChartWell>

            {summary.categories.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 2px 0' }}>
                  <span style={eyebrow}>Categories</span>
                  <span style={eyebrow}>{summary.categories.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {summary.categories.map(c => (
                    <CategoryRow
                      key={c.emoji}
                      category={c}
                      max={summary.categories[0].amount}
                      view={view}
                      showShare={!!myId}
                      highlighted={hovered === c.emoji}
                      onHover={setHovered}
                      onOpen={() => openCategory(c.emoji)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '12px 24px 14px', borderTop: `1px solid ${T.line}`, fontFamily: F, fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, color: T.inkFaint }}>
        {mine ? 'Your share of each expense after it’s split, whoever paid.' : 'Full expense amounts, whoever paid.'}
        {' Settlements aren’t spending, so they’re left out. Open an expense from the group to edit it.'}
      </div>
    </SidePanelOrSheet>
  )
}

function CategoryRow({ category, max, view, showShare, highlighted, onHover, onOpen }: {
  category: CategorySpend
  max: number
  view: SpendingView
  showShare: boolean
  highlighted: boolean
  onHover: (emoji: string | null) => void
  onOpen: () => void
}) {
  const { fill } = CATEGORY_COLOR[category.emoji]
  return (
    <button
      type="button"
      className={`tactile-raised${highlighted ? ' is-lifted' : ''}`}
      onClick={onOpen}
      onMouseEnter={() => onHover(category.emoji)}
      onMouseLeave={() => onHover(null)}
      style={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr) auto 8px', alignItems: 'center', gap: 13, width: '100%', minHeight: 64, padding: '10px 14px 10px 12px', border: 0, borderRadius: T.r.card, fontFamily: F, textAlign: 'left', color: T.ink }}
    >
      <CategoryIcon emoji={category.emoji} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14.5, fontWeight: 700 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.label}</span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: T.inkFaint, fontVariantNumeric: 'tabular-nums' }}>{sharePercent(category.fraction)}</span>
        </span>
        <span style={{ display: 'block', height: 6, marginTop: 8, borderRadius: 4, background: T.surfaceAlt, overflow: 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: `${max > 0 ? (category.amount / max) * 100 : 0}%`, borderRadius: 4, background: fill, transition: 'width .35s cubic-bezier(.2,.8,.2,1)' }} />
        </span>
      </span>
      <span style={{ textAlign: 'right', fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatWholeDollars(category.amount)}
        {showShare && (
          <small style={{ display: 'block', marginTop: 3, fontSize: 12, fontWeight: 600, color: T.inkFaint }}>
            {view === 'mine' ? `of ${formatWholeDollars(category.total)} total` : `${formatWholeDollars(category.yourShare)} yours`}
          </small>
        )}
      </span>
      <svg aria-hidden width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1.5 1l5 5.5-5 5.5" stroke={T.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )
}

function CategoryIcon({ emoji, size = 36 }: { emoji: string; size?: number }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, borderRadius: size > 36 ? 14 : 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.47, background: T.surfaceAlt }}>
      {emoji}
      <i style={{ position: 'absolute', right: -2, bottom: -2, width: 11, height: 11, borderRadius: '50%', background: CATEGORY_COLOR[emoji].fill, boxShadow: `0 0 0 2.5px ${T.surface}` }} />
    </span>
  )
}

function CategoryDetail({ emoji, category, view, period, phrase, controls, months, allMonths, members, myId, today, onPickMonth, onBack }: {
  emoji: string
  /** Undefined when this category has nothing in the selected period. */
  category?: CategorySpend
  view: SpendingView
  period: SpendingPeriod
  phrase: string
  controls: React.ReactNode
  months: MonthSpend[]
  allMonths: MonthSpend[]
  members: GroupMember[]
  myId?: string
  today: string
  onPickMonth: (month: string) => void
  onBack: () => void
}) {
  const label = CATEGORIES.find(c => c.emoji === emoji)?.label ?? ''
  const { fill } = CATEGORY_COLOR[emoji]
  const expenses = category?.expenses ?? []
  const shares = calcMemberShares(expenses)
  const average = allMonths.reduce((s, m) => s + viewAmount(m.byCategory[emoji], view), 0) / allMonths.length
  const values = months.map(m => viewAmount(m.byCategory[emoji], view))
  const max = Math.max(0, ...values)

  function memberName(id: string): string {
    if (id === myId) return 'You'
    const member = members.find(m => m.id === id)
    return member ? firstName(displayName(member)) : 'Former member'
  }

  function payerLabel(e: Expense): string {
    if (e.paid_by === myId) return 'You paid'
    const member = members.find(m => m.id === e.paid_by) ?? e.payer
    return member ? `${firstName(displayName(member))} paid` : 'Paid by a former member'
  }

  return (
    <>
      <Btn
        variant="soft"
        size="sm"
        onClick={onBack}
        style={{ justifySelf: 'start', fontWeight: 700 }}
        icon={<svg aria-hidden width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M6 1L1.5 5.5 6 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      >
        All categories
      </Btn>

      {controls}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '10px 2px 4px' }}>
        <CategoryIcon emoji={emoji} size={48} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 21, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>{label}</div>
          <div style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: T.inkMuted }}>{view === 'mine' ? 'Your share' : 'Spent'} {phrase}</div>
        </div>
        <div style={{ flexShrink: 0, marginLeft: 'auto', fontFamily: FH, fontSize: 26, fontWeight: 700, letterSpacing: -0.8, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {formatWholeDollars(category?.amount ?? 0)}
        </div>
      </div>

      <div style={{ padding: '14px 16px 12px', borderRadius: T.r.lg, boxShadow: T.shadowHair }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={eyebrow}>{months.length > 0 ? monthRange(months[0].month, months[months.length - 1].month) : ''}</span>
          <b style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted }}>Monthly average <span style={{ color: T.ink, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatWholeDollars(average)}</span></b>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: 8, alignItems: 'end', height: 120, marginTop: 12 }}>
          {months.map((m, i) => {
            const on = period === ALL_TIME || period === m.month
            return (
              <button
                key={m.month}
                type="button"
                aria-label={`${monthShort(m.month)}, ${formatWholeDollars(values[i])}`}
                aria-pressed={period === m.month}
                onClick={() => onPickMonth(m.month)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%', minWidth: 0, padding: 0, border: 0, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: F }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>{values[i] ? formatWholeDollars(values[i]) : '—'}</span>
                <span style={{ width: '100%', maxWidth: 40, height: max > 0 && values[i] ? Math.max((values[i] / max) * 70, 4) : 0, borderRadius: '7px 7px 4px 4px', background: fill, opacity: on ? 1 : 0.32, transition: 'height .35s cubic-bezier(.2,.8,.2,1)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: on ? T.ink : T.inkFaint }}>{monthShort(m.month)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {shares.length > 0 && (
        <>
          <div style={{ ...eyebrow, margin: '12px 2px 0' }}>How it splits</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {shares.map(s => {
              const member = members.find(m => m.id === s.memberId)
              return (
                <div key={s.memberId} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: T.r.card, boxShadow: T.shadowHair, fontWeight: 700 }}>
                  <Avatar profile={member ? avatarProfile(member) : undefined} slot={slotFor(members, s.memberId)} size={28} isYou={s.memberId === myId} />
                  <span style={{ minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {memberName(s.memberId)}
                    <small style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>{sharePercent(s.fraction)}</small>
                  </span>
                  <b style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatWholeDollars(s.amount)}</b>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '12px 2px 0' }}>
        <span style={eyebrow}>{period === ALL_TIME ? 'All expenses' : `${monthName(period)} expenses`}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.inkFaint }}>
          <svg aria-hidden width="11" height="12" viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="5" width="9" height="6.2" rx="1.8" /><path d="M3 5V3.6a2.5 2.5 0 015 0V5" /></svg>
          Read-only here
        </span>
      </div>

      <div style={{ borderRadius: T.r.card, boxShadow: T.shadowHair, overflow: 'hidden' }}>
        {expenses.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: T.inkFaint }}>Nothing in {label} {phrase}.</div>
        )}
        {expenses.map((e, i) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 50, padding: '8px 14px', borderTop: i > 0 ? `1px solid ${T.line}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
              <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>{shortDate(e.expense_date, today)} · {payerLabel(e)}</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 13.5, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{formatDollars(Number(e.amount))}</span>
          </div>
        ))}
      </div>
    </>
  )
}
