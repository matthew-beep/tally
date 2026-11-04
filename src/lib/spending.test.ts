import { describe, it, expect } from 'vitest'
import {
  ALL_TIME, calcMemberShares, calcMonthContext, calcMonthly, calcSpending, chartMonths, currentMonth,
  monthLabel, monthName, monthRange, monthsBetween, periodPhrase, shiftMonth, spendingBounds, viewAmount,
} from './spending'
import type { Expense } from '@/types'

const split = (group_member_id: string, owed_amount: number) =>
  ({ id: group_member_id, expense_id: 'x', group_member_id, owed_amount })

function expense(amount: number, over: Partial<Expense> = {}): Expense {
  return {
    id: 'e-' + Math.random().toString(36).slice(2),
    group_id: 'g',
    paid_by: 'me',
    amount,
    category: '🍽️',
    description: 'test',
    expense_date: '2026-11-02',
    deleted_at: null,
    ...over,
  } as Expense
}

describe('calcSpending', () => {
  it('adds up the total and groups it by category, largest first', () => {
    const s = calcSpending([
      expense(10, { category: '🍽️' }),
      expense(20, { category: '🍽️' }),
      expense(60, { category: '🛒' }),
    ], ALL_TIME)

    expect(s.amount).toBe(90)
    expect(s.categories.map(c => [c.emoji, c.amount])).toEqual([['🛒', 60], ['🍽️', 30]])
    expect(s.categories[0].fraction).toBeCloseTo(2 / 3)
    expect(s.categories[0].label).toBe('Groceries')
  })

  it('your share counts your split of each expense, whoever paid', () => {
    const rows = [
      expense(90, { paid_by: 'me', splits: [split('me', 30), split('sam', 30), split('kim', 30)] }),
      expense(40, { paid_by: 'sam', splits: [split('me', 10), split('sam', 30)] }),
    ]
    const s = calcSpending(rows, ALL_TIME, 'mine', 'me')
    expect(s.amount).toBe(40)
    expect(s.categories[0]).toMatchObject({ amount: 40, total: 130, yourShare: 40, fraction: 1 })
  })

  it('whole group still reports your share beside the full amount', () => {
    const s = calcSpending([expense(90, { splits: [split('me', 30), split('sam', 60)] })], ALL_TIME, 'group', 'me')
    expect(s.categories[0]).toMatchObject({ amount: 90, total: 90, yourShare: 30 })
  })

  it('keeps a category you have no share in, at zero', () => {
    const s = calcSpending([expense(50, { paid_by: 'sam', splits: [split('sam', 50)] })], ALL_TIME, 'mine', 'me')
    expect(s.amount).toBe(0)
    expect(s.categories[0]).toMatchObject({ amount: 0, total: 50, fraction: 0 })
  })

  it('your share is zero without a seat in the group', () => {
    const s = calcSpending([expense(90, { splits: [split('me', 90)] })], ALL_TIME, 'mine', undefined)
    expect(s.amount).toBe(0)
  })

  it('counts a missing or retired category as Other', () => {
    const s = calcSpending([
      expense(5, { category: null }),
      expense(7, { category: '🦄' }),
    ], ALL_TIME)

    expect(s.categories).toHaveLength(1)
    expect(s.categories[0].emoji).toBe('💸')
    expect(s.categories[0].total).toBe(12)
  })

  it('leaves out deleted expenses', () => {
    const s = calcSpending([
      expense(10),
      expense(99, { deleted_at: '2026-11-01T00:00:00Z' }),
    ], ALL_TIME)
    expect(s.amount).toBe(10)
  })

  it('keeps cents exact, including amounts that arrive as strings', () => {
    expect(calcSpending([expense(0.1), expense(0.2)], ALL_TIME).amount).toBe(0.3)
    expect(calcSpending([expense('12.50' as unknown as number), expense('1.25' as unknown as number)], ALL_TIME).amount).toBe(13.75)
  })

  it('lists each category newest first', () => {
    const s = calcSpending([
      expense(1, { description: 'old', expense_date: '2026-10-01' }),
      expense(2, { description: 'new', expense_date: '2026-11-02' }),
    ], ALL_TIME)
    expect(s.categories[0].expenses.map(e => e.description)).toEqual(['new', 'old'])
  })

  it('selects one month exactly, with no time zone drift at its edges', () => {
    const rows = [
      expense(1, { expense_date: '2026-11-01' }),
      expense(2, { expense_date: '2026-10-31' }),
      expense(4, { expense_date: '2026-10-01' }),
      expense(8, { expense_date: '2026-09-30' }),
    ]
    expect(calcSpending(rows, '2026-11').amount).toBe(1)
    expect(calcSpending(rows, '2026-10').amount).toBe(6)
    expect(calcSpending(rows, '2026-09').amount).toBe(8)
    expect(calcSpending(rows, ALL_TIME).amount).toBe(15)
  })

  it('an empty month is safe to render', () => {
    expect(calcSpending([expense(5)], '2026-01')).toEqual({ amount: 0, categories: [] })
  })
})

describe('calcMonthly', () => {
  it('gives every month an entry, in order, split by category and share', () => {
    const rows = [
      expense(10, { expense_date: '2026-09-05', category: '🛒', splits: [split('me', 4), split('sam', 6)] }),
      expense(20, { expense_date: '2026-11-05', category: '🛒', splits: [split('me', 20)] }),
      expense(5, { expense_date: '2026-11-06', category: null, splits: [split('sam', 5)] }),
      expense(99, { expense_date: '2026-11-07', deleted_at: '2026-11-08T00:00:00Z' }),
    ]
    expect(calcMonthly(rows, ['2026-09', '2026-10', '2026-11'], 'me')).toEqual([
      { month: '2026-09', total: 10, yourShare: 4, byCategory: { '🛒': { total: 10, yourShare: 4 } } },
      { month: '2026-10', total: 0, yourShare: 0, byCategory: {} },
      { month: '2026-11', total: 25, yourShare: 20, byCategory: { '🛒': { total: 20, yourShare: 20 }, '💸': { total: 5, yourShare: 0 } } },
    ])
  })

  it('viewAmount picks the figure a view counts', () => {
    const spend = { total: 10, yourShare: 4 }
    expect(viewAmount(spend, 'group')).toBe(10)
    expect(viewAmount(spend, 'mine')).toBe(4)
    expect(viewAmount(undefined, 'mine')).toBe(0)
  })
})

describe('calcMemberShares', () => {
  it('sums each seat across expenses, largest first, skipping zero and deleted', () => {
    const shares = calcMemberShares([
      expense(30, { splits: [split('me', 10), split('sam', 20)] }),
      expense(10, { splits: [split('me', 10), split('kim', 0)] }),
      expense(99, { deleted_at: '2026-11-01T00:00:00Z', splits: [split('kim', 99)] }),
    ])
    expect(shares.map(s => [s.memberId, s.amount])).toEqual([['me', 20], ['sam', 20]])
    expect(shares[0].fraction).toBeCloseTo(0.5)
  })

  it('handles more than two people, and nothing at all', () => {
    expect(calcMemberShares([expense(9, { splits: [split('a', 3), split('b', 3), split('c', 3)] })])).toHaveLength(3)
    expect(calcMemberShares([])).toEqual([])
  })
})

describe('calcMonthContext', () => {
  const bounds = { first: '2026-08', last: '2026-11' }
  const months = ['2026-08', '2026-09', '2026-10', '2026-11']
  const monthly = (amounts: number[]) => calcMonthly(
    amounts.map((a, i) => expense(a, { expense_date: `${months[i]}-05`, splits: [split('me', a / 2)] })).filter(e => e.amount > 0),
    months, 'me',
  )
  const today = '2026-11-03'

  it('never compares a month still in progress', () => {
    expect(calcMonthContext('2026-11', 10, monthly([100, 100, 200, 10]), 'group', bounds, today))
      .toEqual({ kind: 'inProgress', day: 3, previous: { month: '2026-10', amount: 200 } })
  })

  it('compares a finished month with the one before it, in the chosen view', () => {
    const m = monthly([100, 100, 150, 10])
    expect(calcMonthContext('2026-10', 150, m, 'group', bounds, today))
      .toEqual({ kind: 'change', percent: 50, previous: { month: '2026-09', amount: 100 } })
    expect(calcMonthContext('2026-10', 75, m, 'mine', bounds, today))
      .toEqual({ kind: 'change', percent: 50, previous: { month: '2026-09', amount: 50 } })
  })

  it('reports a drop as a negative percent', () => {
    expect(calcMonthContext('2026-10', 50, monthly([100, 100, 50, 10]), 'group', bounds, today))
      .toMatchObject({ kind: 'change', percent: -50 })
  })

  it('calls a tiny difference the same', () => {
    expect(calcMonthContext('2026-10', 100.5, monthly([100, 100, 100.5, 10]), 'group', bounds, today))
      .toMatchObject({ kind: 'same' })
  })

  it('has no comparison for the first month, or after a month with no spend', () => {
    expect(calcMonthContext('2026-08', 100, monthly([100, 0, 100, 10]), 'group', bounds, today)).toEqual({ kind: 'first' })
    expect(calcMonthContext('2026-10', 100, monthly([100, 0, 100, 10]), 'group', bounds, today))
      .toEqual({ kind: 'noPrevious', previousMonth: '2026-09' })
  })

  it('a first month still in progress has nothing to point back at', () => {
    expect(calcMonthContext('2026-11', 10, [], 'group', { first: '2026-11', last: '2026-11' }, today))
      .toEqual({ kind: 'inProgress', day: 3, previous: null })
  })

  it('averages all time over the months the group has existed', () => {
    expect(calcMonthContext(ALL_TIME, 400, monthly([100, 100, 100, 100]), 'group', bounds, today))
      .toEqual({ kind: 'allTime', months: 4, average: 100 })
  })
})

describe('months', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2027-01', -2)).toBe('2026-11')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('lists months inclusively', () => {
    expect(monthsBetween('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(monthsBetween('2026-11', '2026-11')).toEqual(['2026-11'])
  })

  it('names months without shifting them', () => {
    expect(monthName('2026-11')).toBe('November')
    expect(monthLabel('2026-01')).toBe('January 2026')
    expect(currentMonth('2026-11-03')).toBe('2026-11')
  })

  it('formats ranges within and across years', () => {
    expect(monthRange('2026-06', '2026-11')).toBe('Jun – Nov 2026')
    expect(monthRange('2025-06', '2026-11')).toBe('Jun 2025 – Nov 2026')
    expect(monthRange('2026-11', '2026-11')).toBe('Nov 2026')
  })

  it('phrases a period relative to today', () => {
    const bounds = { first: '2026-06', last: '2026-11' }
    expect(periodPhrase('2026-11', bounds, '2026-11-03')).toBe('in November so far')
    expect(periodPhrase('2026-10', bounds, '2026-11-03')).toBe('in October')
    expect(periodPhrase('2025-10', bounds, '2026-11-03')).toBe('in October 2025')
    expect(periodPhrase(ALL_TIME, bounds, '2026-11-03')).toBe('since June')
    expect(periodPhrase(ALL_TIME, { first: '2025-06', last: '2026-11' }, '2026-11-03')).toBe('since June 2025')
  })

  it('bounds run from the first expense to this month', () => {
    expect(spendingBounds([expense(1, { expense_date: '2026-05-20' })], '2026-11-03'))
      .toEqual({ first: '2026-05', last: '2026-11' })
  })

  it('bounds reach an expense dated ahead, and ignore deleted ones', () => {
    expect(spendingBounds([
      expense(1, { expense_date: '2027-02-01' }),
      expense(1, { expense_date: '2020-01-01', deleted_at: '2026-01-01T00:00:00Z' }),
    ], '2026-11-03')).toEqual({ first: '2026-11', last: '2027-02' })
  })

  it('bounds with no expenses are just this month', () => {
    expect(spendingBounds([], '2026-11-03')).toEqual({ first: '2026-11', last: '2026-11' })
  })

  it('charts six months ending at the selection, never before the first expense', () => {
    const bounds = { first: '2025-01', last: '2026-11' }
    expect(chartMonths('2026-03', bounds)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])
    expect(chartMonths(ALL_TIME, bounds)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(chartMonths('2026-11', { first: '2026-10', last: '2026-11' })).toEqual(['2026-10', '2026-11'])
  })
})
