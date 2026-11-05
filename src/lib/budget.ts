import { CATEGORIES } from './categories'
import { round2 } from './money'
import { calcMonthly, calcSpending, currentMonth, monthsBetween, shiftMonth, spendingBounds, type CategorySpend } from './spending'
import { localISODate } from './time'
import type { Expense } from '@/types'

/** One saved budget. It applies from `month` until a later one replaces it. */
export interface BudgetVersion {
  /** `yyyy-MM` */
  month: string
  cap: number | null
  /** Category emoji → limit. */
  limits: Record<string, number>
}

export interface LimitState {
  emoji: string
  label: string
  limit: number
  spent: number
  left: number
  over: boolean
  /** `spent` as a fraction of `limit`. Can pass 1. */
  fraction: number
}

export type MonthPhase = 'past' | 'current' | 'future'

export interface BudgetMonth {
  phase: MonthPhase
  /** Whole-group spending that month, whoever paid. */
  spent: number
  cap: number | null
  /** Negative when over. Null with no monthly total. */
  left: number | null
  over: boolean
  /** `spent` as a fraction of `cap`. Can pass 1. Null with no monthly total. */
  fraction: number | null
  /** Days after today in the month. Zero outside the current month. */
  daysLeft: number
  /** What's left per remaining day. Null unless the current month has room and days. */
  perDay: number | null
  /** In CATEGORIES order. */
  limits: LimitState[]
  overLimits: LimitState[]
}

export interface BudgetCategoryRow {
  category: CategorySpend
  /** Null for a category with no limit. */
  limit: LimitState | null
}

/**
 * The budget a month is measured against: the latest one starting on or before
 * it. A version with no total and no limits is a removal, so it reads as none.
 * `versions` needn't be sorted.
 */
export function budgetForMonth(versions: BudgetVersion[], month: string): BudgetVersion | null {
  const current = versions
    .filter(v => v.month <= month)
    .reduce<BudgetVersion | null>((latest, v) => (!latest || v.month > latest.month ? v : latest), null)
  if (!current || (current.cap == null && Object.keys(current.limits).length === 0)) return null
  return current
}

function monthDays(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/**
 * A month's whole-group spending against its budget. Deleted expenses don't
 * count and settlements never do, because both come through calcSpending.
 */
export function calcBudgetMonth(
  expenses: Expense[],
  budget: BudgetVersion,
  month: string,
  today: string = localISODate(),
): BudgetMonth {
  const { amount: spent, categories } = calcSpending(expenses, month)
  const now = currentMonth(today)
  const phase: MonthPhase = month < now ? 'past' : month > now ? 'future' : 'current'

  const limits = CATEGORIES.flatMap((c): LimitState[] => {
    const limit = budget.limits[c.emoji]
    if (limit == null) return []
    const catSpent = categories.find(cat => cat.emoji === c.emoji)?.total ?? 0
    return [{
      emoji: c.emoji,
      label: c.label,
      limit,
      spent: catSpent,
      left: round2(limit - catSpent),
      over: catSpent > limit,
      fraction: catSpent / limit,
    }]
  })

  const cap = budget.cap
  const left = cap == null ? null : round2(cap - spent)
  const over = left != null && left < 0
  const daysLeft = phase === 'current' ? monthDays(month) - Number(today.slice(8, 10)) : 0

  return {
    phase,
    spent,
    cap,
    left,
    over,
    fraction: cap == null ? null : spent / cap,
    daysLeft,
    perDay: phase === 'current' && left != null && left >= 0 && daysLeft > 0 ? left / daysLeft : null,
    limits,
    overLimits: limits.filter(l => l.over),
  }
}

/**
 * Categories with a limit first, most used first, including a limit nothing has
 * been spent against yet. Everything else follows, largest first.
 */
export function budgetCategoryRows(categories: CategorySpend[], state: BudgetMonth): BudgetCategoryRow[] {
  const limited = [...state.limits]
    .sort((a, b) => b.fraction - a.fraction)
    .map((limit): BudgetCategoryRow => ({
      limit,
      category: categories.find(c => c.emoji === limit.emoji) ?? {
        emoji: limit.emoji, label: limit.label, amount: 0, total: 0, yourShare: 0, fraction: 0, expenses: [],
      },
    }))
  const rest = categories
    .filter(c => !state.limits.some(l => l.emoji === c.emoji))
    .map((category): BudgetCategoryRow => ({ category, limit: null }))
  return [...limited, ...rest]
}

/** Average spend per finished month, before this one. Null with no history. */
export function averageFinishedMonth(expenses: Expense[], today: string = localISODate()): number | null {
  const bounds = spendingBounds(expenses, today)
  const lastFinished = shiftMonth(currentMonth(today), -1)
  if (bounds.first > lastFinished) return null
  const months = calcMonthly(expenses, monthsBetween(bounds.first, lastFinished))
  return months.reduce((s, m) => s + m.total, 0) / months.length
}

/** A starting total for a first budget: the group's average, rounded up to the next $100. */
export function suggestedCap(expenses: Expense[], today: string = localISODate()): number | null {
  const average = averageFinishedMonth(expenses, today)
  return average ? Math.ceil(average / 100) * 100 : null
}

/** What a budget amount field holds, as a saveable number. Null when it isn't one. */
export function parseBudgetAmount(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n)) return null
  const rounded = round2(n)
  // numeric(10,2) tops out just under 100 million.
  return rounded > 0 && rounded < 100_000_000 ? rounded : null
}
