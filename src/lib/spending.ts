import { CATEGORIES } from './categories'
import { isLive } from './balance'
import { round2 } from './money'
import { localISODate } from './time'
import type { Expense } from '@/types'

/** Either one month as `yyyy-MM`, or ALL_TIME. */
export type SpendingPeriod = string
export const ALL_TIME = 'all'

/** Whole group: full expense amounts. Mine: this member's split of each expense. */
export type SpendingView = 'group' | 'mine'

export interface CategorySpend {
  emoji: string
  label: string
  /** What the current view counts: `total`, or `yourShare`. */
  amount: number
  /** Full expense amounts. */
  total: number
  /** This member's split of those expenses, whoever paid. */
  yourShare: number
  /** `amount` as a fraction of the summary's amount, 0–1. */
  fraction: number
  /** Newest first. */
  expenses: Expense[]
}

export interface SpendingSummary {
  amount: number
  /** Largest first; ties keep the CATEGORIES order. Categories with no expenses are left out. */
  categories: CategorySpend[]
}

export interface MonthCategorySpend {
  total: number
  yourShare: number
}

export interface MonthSpend extends MonthCategorySpend {
  month: string
  /** Category emoji → spend. Categories with no expenses that month are absent. */
  byCategory: Record<string, MonthCategorySpend>
}

export interface MonthBounds {
  first: string
  last: string
}

export interface MemberShare {
  memberId: string
  amount: number
  fraction: number
}

export type MonthContext =
  | { kind: 'allTime'; months: number; average: number }
  | { kind: 'inProgress'; day: number; previous: { month: string; amount: number } | null }
  | { kind: 'first' }
  | { kind: 'noPrevious'; previousMonth: string }
  | { kind: 'same'; previous: { month: string; amount: number } }
  | { kind: 'change'; percent: number; previous: { month: string; amount: number } }

const OTHER = CATEGORIES[CATEGORIES.length - 1]

/**
 * Dates are compared as `yyyy-MM` strings and never through `new Date(iso)`,
 * which parses a bare date as UTC and moves Oct 1 into September west of it.
 */
function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function monthDate(month: string): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** An expense with no category, or one outside CATEGORIES, counts as Other. */
function categoryOf(e: Expense): string {
  return CATEGORIES.some(c => c.emoji === e.category) ? (e.category as string) : OTHER.emoji
}

function sum(rows: Expense[]): number {
  return round2(rows.reduce((s, e) => s + Number(e.amount), 0))
}

function yourShareOf(e: Expense, myId?: string): number {
  if (myId === undefined) return 0
  return Number(e.splits?.find(s => s.group_member_id === myId)?.owed_amount ?? 0)
}

function sumShares(rows: Expense[], myId?: string): number {
  return round2(rows.reduce((s, e) => s + yourShareOf(e, myId), 0))
}

export function currentMonth(today: string = localISODate()): string {
  return monthOf(today)
}

export function shiftMonth(month: string, by: number): string {
  const d = monthDate(month)
  const shifted = new Date(d.getFullYear(), d.getMonth() + by, 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`
}

/** Every month from `first` to `last`, inclusive. */
export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = []
  for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push(m)
  return months
}

/** "October" */
export function monthName(month: string): string {
  return monthDate(month).toLocaleDateString('en-US', { month: 'long' })
}

/** "Oct" */
export function monthShort(month: string): string {
  return monthDate(month).toLocaleDateString('en-US', { month: 'short' })
}

/** "October 2026" */
export function monthLabel(month: string): string {
  return monthDate(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** The months worth offering: first expense through this month, or later if an expense is dated ahead. */
export function spendingBounds(expenses: Expense[], today: string = localISODate()): MonthBounds {
  const now = currentMonth(today)
  const months = expenses.filter(isLive).map(e => monthOf(e.expense_date))
  return months.reduce<MonthBounds>(
    (b, m) => ({ first: m < b.first ? m : b.first, last: m > b.last ? m : b.last }),
    { first: now, last: now },
  )
}

/** Up to `count` months to chart, ending at the selected month, or at `last` for all time. */
export function chartMonths(period: SpendingPeriod, bounds: MonthBounds, count = 6): string[] {
  const end = period === ALL_TIME ? bounds.last : period
  const start = shiftMonth(end, 1 - count)
  return monthsBetween(start > bounds.first ? start : bounds.first, end)
}

/**
 * Total spend in a group, by category.
 *
 * Settlements aren't spending, so they play no part, and nothing here feeds a
 * balance. Every expense lands in exactly one category, so the categories
 * always add up to the total.
 */
export function calcSpending(
  expenses: Expense[],
  period: SpendingPeriod,
  view: SpendingView = 'group',
  myId?: string,
): SpendingSummary {
  const live = expenses.filter(e => isLive(e) && (period === ALL_TIME || monthOf(e.expense_date) === period))
  const amountOf = (rows: Expense[]) => (view === 'mine' ? sumShares(rows, myId) : sum(rows))
  const amount = amountOf(live)

  const categories = CATEGORIES
    .map((c): CategorySpend => {
      const rows = live.filter(e => categoryOf(e) === c.emoji)
      const catAmount = amountOf(rows)
      return {
        emoji: c.emoji,
        label: c.label,
        amount: catAmount,
        total: sum(rows),
        yourShare: sumShares(rows, myId),
        fraction: amount > 0 ? catAmount / amount : 0,
        expenses: [...rows].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
      }
    })
    .filter(c => c.expenses.length > 0)
    .sort((a, b) => b.amount - a.amount)

  return { amount, categories }
}

/** Spend per month, in the order given. A month with no expenses still gets an entry. */
export function calcMonthly(expenses: Expense[], months: string[], myId?: string): MonthSpend[] {
  const live = expenses.filter(isLive)
  return months.map(month => {
    const rows = live.filter(e => monthOf(e.expense_date) === month)
    const byCategory: Record<string, MonthCategorySpend> = {}
    CATEGORIES.forEach(c => {
      const catRows = rows.filter(e => categoryOf(e) === c.emoji)
      if (catRows.length > 0) byCategory[c.emoji] = { total: sum(catRows), yourShare: sumShares(catRows, myId) }
    })
    return { month, total: sum(rows), yourShare: sumShares(rows, myId), byCategory }
  })
}

/** Pick the figure a view counts, from a month or a category within one. */
export function viewAmount(spend: MonthCategorySpend | undefined, view: SpendingView): number {
  if (!spend) return 0
  return view === 'mine' ? spend.yourShare : spend.total
}

/** How these expenses divide between seats, largest first. Seats with nothing are left out. */
export function calcMemberShares(expenses: Expense[]): MemberShare[] {
  const bySeat = new Map<string, number>()
  expenses.filter(isLive).forEach(e => {
    e.splits?.forEach(s => bySeat.set(s.group_member_id, (bySeat.get(s.group_member_id) ?? 0) + Number(s.owed_amount)))
  })
  const whole = [...bySeat.values()].reduce((a, b) => a + b, 0)
  return [...bySeat.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({ memberId, amount: round2(amount), fraction: whole > 0 ? amount / whole : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * The line under the total. A month still in progress is never compared as a
 * percentage: on the 3rd, "−90% vs October" says nothing about spending.
 */
export function calcMonthContext(
  period: SpendingPeriod,
  amount: number,
  monthly: MonthSpend[],
  view: SpendingView,
  bounds: MonthBounds,
  today: string = localISODate(),
): MonthContext {
  if (period === ALL_TIME) {
    const months = monthsBetween(bounds.first, bounds.last).length
    return { kind: 'allTime', months, average: amount / months }
  }

  const previousMonth = shiftMonth(period, -1)
  const previous = previousMonth >= bounds.first
    ? { month: previousMonth, amount: viewAmount(monthly.find(m => m.month === previousMonth), view) }
    : null

  if (period === currentMonth(today)) {
    return { kind: 'inProgress', day: Number(today.slice(8, 10)), previous }
  }
  if (!previous) return { kind: 'first' }
  if (previous.amount === 0) return { kind: 'noPrevious', previousMonth }

  const percent = ((amount - previous.amount) / previous.amount) * 100
  if (Math.abs(percent) < 1) return { kind: 'same', previous }
  return { kind: 'change', percent: Math.round(percent), previous }
}

/** "in November so far", "in October", "in October 2025", or "since June". */
export function periodPhrase(period: SpendingPeriod, bounds: MonthBounds, today: string = localISODate()): string {
  const named = (month: string) => (month.slice(0, 4) === today.slice(0, 4) ? monthName(month) : monthLabel(month))
  if (period === ALL_TIME) return `since ${named(bounds.first)}`
  if (period === currentMonth(today)) return `in ${monthName(period)} so far`
  return `in ${named(period)}`
}

/** "Jun – Nov 2026", or "Jun 2025 – Nov 2026" across years. */
export function monthRange(first: string, last: string): string {
  const year = (m: string) => m.slice(0, 4)
  if (first === last) return `${monthShort(last)} ${year(last)}`
  const start = year(first) === year(last) ? monthShort(first) : `${monthShort(first)} ${year(first)}`
  return `${start} – ${monthShort(last)} ${year(last)}`
}
