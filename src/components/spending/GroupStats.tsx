'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { Segmented } from '@/components/Segmented'
import { budgetCategoryRows, budgetForMonth, calcBudgetMonth, type BudgetCategoryRow, type LimitState } from '@/lib/budget'
import { CATEGORIES } from '@/lib/categories'
import { formatDollars, formatWholeDollars, splitAmount } from '@/lib/money'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import {
  ALL_TIME, calcMemberShares, calcMonthContext, calcMonthly, calcSpending, chartMonths, currentMonth,
  monthName, monthRange, monthShort, monthsBetween, periodPhrase, spendingBounds, viewAmount,
  type CategorySpend, type MonthContext, type MonthSpend, type SpendingPeriod, type SpendingView,
} from '@/lib/spending'
import { localISODate } from '@/lib/time'
import { useGroupBudget } from '@/queries/useGroupBudget'
import type { Expense, GroupMember } from '@/types'
import { BudgetCard, LockLabel, SetBudgetPrompt } from './BudgetCard'
import { BudgetEditSheet } from './BudgetEditSheet'
import { MonthPicker } from './MonthPicker'
import { CATEGORY_COLOR, ChartWell, OverTimeChart, RingChart, sharePercent, type ChartKind } from './SpendingCharts'

interface Props {
  groupId: string
  groupName: string
  expenses: Expense[]
  members: GroupMember[]
  myId?: string
  /** Active members can change the budget. Someone previewing an invite can't. */
  canEdit: boolean
}

const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: T.inkFaint } as const
const stack = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridAutoRows: 'max-content', alignContent: 'start', gap: 12 } as const

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

function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: '0 2px', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: T.inkFaint }}>{children}</div>
}

/**
 * The group's Stats tab: where its money went, for one month or all time, and
 * how that compares with its budget. Whole group counts full expense amounts;
 * Your share counts your split of each one, whoever paid. Neither is a balance,
 * and a budget only ever measures the whole group.
 */
export function GroupStats({ groupId, groupName, expenses, members, myId, canEdit }: Props) {
  const today = localISODate()
  const [pickedMonth, setPickedMonth] = useState<string | null>(null)
  const [isAll, setIsAll] = useState(false)
  const [viewChoice, setViewChoice] = useState<SpendingView>('group')
  const [chart, setChart] = useState<ChartKind>('ring')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Moving between the overview and a category starts at the top of the new view.
  useEffect(() => {
    rootRef.current?.closest('.group-detail-right')?.scrollTo({ top: 0 })
  }, [selected])

  // With one person, whole group and your share are the same number.
  const solo = members.length === 1
  const view: SpendingView = solo ? 'group' : viewChoice
  const mine = view === 'mine'

  const budgetQuery = useGroupBudget(groupId)
  const versions = useMemo(() => budgetQuery.data ?? [], [budgetQuery.data])
  const thisMonth = currentMonth(today)

  const month = pickedMonth ?? thisMonth
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

  // A budget is compared only in the whole-group view of a single month.
  const budget = !isAll && !mine ? budgetForMonth(versions, month) : null
  const budgetState = useMemo(
    () => (budget ? calcBudgetMonth(expenses, budget, month, today) : null),
    [budget, expenses, month, today],
  )
  const rows: BudgetCategoryRow[] = useMemo(
    () => budgetState
      ? budgetCategoryRows(summary.categories, budgetState)
      : summary.categories.map(category => ({ category, limit: null })),
    [budgetState, summary.categories],
  )
  const maxAmount = Math.max(0, ...rows.map(r => r.category.amount))

  const capLines = useMemo(() => {
    if (mine) return {}
    return Object.fromEntries(recentMonths.flatMap(m => {
      const cap = budgetForMonth(versions, m.month)?.cap
      return cap != null ? [[m.month, cap]] : []
    }))
  }, [mine, recentMonths, versions])

  const hasCurrentBudget = budgetForMonth(versions, thisMonth) != null

  function openCategory(emoji: string) {
    setHovered(null)
    setSelected(emoji)
  }

  function pickMonth(next: string) {
    setPickedMonth(next)
    setIsAll(false)
  }

  function openEdit() {
    setPickedMonth(null)
    setIsAll(false)
    setEditing(true)
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

  // Nothing about a budget until it has loaded, so a failed or slow fetch can't
  // read as "this group has no budget" and offer to set a new one.
  let budgetSection: React.ReactNode = null
  if (budgetQuery.isSuccess && !isAll) {
    if (mine) {
      if (hasCurrentBudget) budgetSection = <Note>The budget tracks the whole group&rsquo;s spending, so it&rsquo;s hidden in Your share.</Note>
    } else if (budgetState) {
      budgetSection = <BudgetCard state={budgetState} month={month} canEdit={canEdit} onEdit={openEdit} />
    } else if (month !== thisMonth) {
      if (month < thisMonth) budgetSection = <Note>No budget was set for {monthName(month)}.</Note>
    } else if (canEdit) {
      budgetSection = <SetBudgetPrompt groupName={groupName} solo={solo} onSet={openEdit} />
    }
  }

  const selectedRow = rows.find(r => r.category.emoji === selected)
  const footnote = (
    <div style={{ gridColumn: '1 / -1', padding: '4px 2px 8px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, color: T.inkFaint }}>
      {mine ? 'Your share of each expense after it’s split, whoever paid.' : solo ? 'Every expense in this group.' : 'Full expense amounts, whoever paid.'}
      {' Settlements aren’t spending, so they’re left out. Open an expense from the group to edit it.'}
    </div>
  )

  return (
    <div ref={rootRef} className="spending-breakdown" style={{ fontFamily: F, color: T.ink }}>
      {selected ? (
        <div style={{ ...stack, maxWidth: 620, margin: '0 auto' }}>
          <CategoryDetail
            emoji={selected}
            category={selectedRow?.category}
            limit={selectedRow?.limit ?? null}
            view={view}
            solo={solo}
            period={period}
            phrase={phrase}
            controls={controls}
            months={recentMonths}
            allMonths={allMonths}
            versions={versions}
            members={members}
            myId={myId}
            today={today}
            canAddLimit={canEdit && budgetQuery.isSuccess && !isAll && !mine && month === thisMonth}
            onEdit={openEdit}
            onPickMonth={pickMonth}
            onBack={() => setSelected(null)}
          />
          {footnote}
        </div>
      ) : (
        // Two columns when the page has room for them, one otherwise. The group
        // page's width depends on its members column, so this goes by what fits
        // rather than by a screen-width breakpoint.
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '20px 32px', alignItems: 'start', maxWidth: 1040, margin: '0 auto' }}>
          <div style={stack}>
            {controls}
            {myId && !solo && (
              <Segmented
                fullWidth
                value={view}
                onChange={setViewChoice}
                options={[{ value: 'group', label: 'Whole group' }, { value: 'mine', label: 'Your share' }]}
              />
            )}
            <Hero label={`${mine ? 'Your share' : 'Total spent'} ${phrase}`} amount={summary.amount} context={context} />
            {budgetSection}
          </div>

          <div style={stack}>
            <Segmented
              fullWidth
              value={chart}
              onChange={setChart}
              options={[{ value: 'ring', label: 'Ring' }, { value: 'time', label: 'Over time' }]}
            />

            <ChartWell>
              {chart === 'time' ? (
                <OverTimeChart months={recentMonths} period={period} view={view} solo={solo} capLines={capLines} hovered={hovered} onHover={setHovered} onPickMonth={pickMonth} />
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

            {rows.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 2px 0' }}>
                  <span style={eyebrow}>Categories</span>
                  <span style={eyebrow}>{rows.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map(({ category, limit }) => (
                    <CategoryRow
                      key={category.emoji}
                      category={category}
                      limit={limit}
                      budgeted={!!budgetState}
                      max={maxAmount}
                      view={view}
                      showShare={!!myId && !solo}
                      highlighted={hovered === category.emoji}
                      onHover={setHovered}
                      onOpen={() => openCategory(category.emoji)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {footnote}
        </div>
      )}

      <BudgetEditSheet
        open={editing}
        onClose={() => setEditing(false)}
        groupId={groupId}
        groupName={groupName}
        solo={solo}
        expenses={expenses}
        versions={versions}
      />
    </div>
  )
}

function CategoryRow({ category, limit, budgeted, max, view, showShare, highlighted, onHover, onOpen }: {
  category: CategorySpend
  limit: LimitState | null
  /** This month has a budget, so bars measure limits rather than shares. */
  budgeted: boolean
  max: number
  view: SpendingView
  showShare: boolean
  highlighted: boolean
  onHover: (emoji: string | null) => void
  onOpen: () => void
}) {
  const { fill } = CATEGORY_COLOR[category.emoji]
  const over = !!limit?.over

  let tag: React.ReactNode = sharePercent(category.fraction)
  let barWidth = max > 0 ? (category.amount / max) * 100 : 0
  let barFill = fill
  let small: React.ReactNode = !showShare ? null : view === 'mine'
    ? `of ${formatWholeDollars(category.total)} total`
    : `${formatWholeDollars(category.yourShare)} yours`

  if (limit) {
    tag = `${Math.round(limit.fraction * 100)}% used`
    barWidth = Math.min(limit.fraction * 100, 100)
    barFill = over ? T.coral : fill
    small = over ? `${formatWholeDollars(-limit.left)} over ${formatWholeDollars(limit.limit)}` : `of ${formatWholeDollars(limit.limit)}`
  } else if (budgeted) {
    // A bar with no limit has nothing to fill toward, so it stays quiet beside the ones that do.
    tag = null
    barFill = T.inkFaint
    small = 'no limit'
  }

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
          {tag && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: over ? T.coralInk : T.inkFaint, fontVariantNumeric: 'tabular-nums' }}>{tag}</span>}
        </span>
        <span style={{ display: 'block', height: 6, marginTop: 8, borderRadius: 4, background: T.surfaceAlt, overflow: 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: `${barWidth}%`, borderRadius: 4, background: barFill, transition: 'width .35s cubic-bezier(.2,.8,.2,1)' }} />
        </span>
      </span>
      <span style={{ textAlign: 'right', fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: over ? T.coralInk : T.ink }}>
        {formatWholeDollars(category.amount)}
        {small && (
          <small style={{ display: 'block', marginTop: 3, fontSize: 12, fontWeight: 600, color: T.inkFaint }}>{small}</small>
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

function LimitRow({ limit, period, today, canAddLimit, onEdit }: {
  limit: LimitState | null
  period: SpendingPeriod
  today: string
  canAddLimit: boolean
  onEdit: () => void
}) {
  const isCurrent = period === currentMonth(today)
  if (!limit && !canAddLimit) return null
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 14px', borderRadius: T.r.card, boxShadow: T.shadowHair, fontWeight: 700 } as const
  const sub = { display: 'block', marginTop: 2, fontSize: 12, fontWeight: 600 } as const

  if (!limit) {
    return (
      <div style={rowStyle}>
        <span style={{ flex: 1, minWidth: 0 }}>
          No monthly limit
          <span style={{ ...sub, color: T.inkFaint }}>This still counts toward any monthly total</span>
        </span>
        <Btn variant="soft" size="sm" onClick={onEdit}>Add a limit</Btn>
      </div>
    )
  }
  return (
    <div style={rowStyle}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {formatWholeDollars(limit.limit)} monthly limit
        <span style={{ ...sub, color: limit.over ? T.coralInk : T.inkFaint }}>
          {limit.over ? `${formatWholeDollars(-limit.left)} over` : `${formatWholeDollars(limit.left)} left`}
        </span>
      </span>
      {isCurrent
        ? canAddLimit && <Btn variant="soft" size="sm" onClick={onEdit}>Edit</Btn>
        : period < currentMonth(today) && <LockLabel>Past month</LockLabel>}
    </div>
  )
}

function CategoryDetail({ emoji, category, limit, view, solo, period, phrase, controls, months, allMonths, versions, members, myId, today, canAddLimit, onEdit, onPickMonth, onBack }: {
  emoji: string
  /** Undefined when this category has nothing in the selected period. */
  category?: CategorySpend
  limit: LimitState | null
  view: SpendingView
  solo: boolean
  period: SpendingPeriod
  phrase: string
  controls: React.ReactNode
  months: MonthSpend[]
  allMonths: MonthSpend[]
  versions: Parameters<typeof budgetForMonth>[0]
  members: GroupMember[]
  myId?: string
  today: string
  canAddLimit: boolean
  onEdit: () => void
  onPickMonth: (month: string) => void
  onBack: () => void
}) {
  const label = CATEGORIES.find(c => c.emoji === emoji)?.label ?? ''
  const { fill } = CATEGORY_COLOR[emoji]
  const expenses = category?.expenses ?? []
  const shares = calcMemberShares(expenses)
  const average = allMonths.reduce((s, m) => s + viewAmount(m.byCategory[emoji], view), 0) / allMonths.length
  const values = months.map(m => viewAmount(m.byCategory[emoji], view))
  const limitLines = months.map(m => (view === 'group' ? budgetForMonth(versions, m.month)?.limits[emoji] ?? 0 : 0))
  const max = Math.max(0, ...values, ...limitLines)
  const BAR = 70

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

      <LimitRow limit={limit} period={period} today={today} canAddLimit={canAddLimit} onEdit={onEdit} />

      <div style={{ padding: '14px 16px 12px', borderRadius: T.r.lg, boxShadow: T.shadowHair }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={eyebrow}>{months.length > 0 ? monthRange(months[0].month, months[months.length - 1].month) : ''}</span>
          <b style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted }}>Monthly average <span style={{ color: T.ink, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatWholeDollars(average)}</span></b>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: 8, alignItems: 'end', height: 120, marginTop: 12 }}>
          {months.map((m, i) => {
            const on = period === ALL_TIME || period === m.month
            const barHeight = max > 0 && values[i] ? Math.max((values[i] / max) * BAR, 4) : 0
            const lineHeight = max > 0 ? (limitLines[i] / max) * BAR : 0
            return (
              <button
                key={m.month}
                type="button"
                aria-label={`${monthShort(m.month)}, ${formatWholeDollars(values[i])}${limitLines[i] ? `, limit ${formatWholeDollars(limitLines[i])}` : ''}`}
                aria-pressed={period === m.month}
                onClick={() => onPickMonth(m.month)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%', minWidth: 0, padding: 0, border: 0, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: F }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>{values[i] ? formatWholeDollars(values[i]) : '—'}</span>
                <span style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: Math.max(barHeight, lineHeight) }}>
                  <span style={{ width: '100%', maxWidth: 40, height: barHeight, borderRadius: '7px 7px 4px 4px', background: fill, opacity: on ? 1 : 0.32, transition: 'height .35s cubic-bezier(.2,.8,.2,1)' }} />
                  {limitLines[i] > 0 && <i aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: lineHeight, borderTop: `2px dashed ${T.ink}`, opacity: 0.55 }} />}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: on ? T.ink : T.inkFaint }}>{monthShort(m.month)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {shares.length > 0 && !solo && (
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
        <LockLabel>Read-only here</LockLabel>
      </div>

      <div style={{ borderRadius: T.r.card, boxShadow: T.shadowHair, overflow: 'hidden' }}>
        {expenses.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: T.inkFaint }}>Nothing in {label} {phrase}.</div>
        )}
        {expenses.map((e, i) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 50, padding: '8px 14px', borderTop: i > 0 ? `1px solid ${T.line}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
              <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>
                {shortDate(e.expense_date, today)}{solo ? '' : ` · ${payerLabel(e)}`}
              </div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 13.5, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{formatDollars(Number(e.amount))}</span>
          </div>
        ))}
      </div>
    </>
  )
}
