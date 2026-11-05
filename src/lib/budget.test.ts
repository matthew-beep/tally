import { describe, it, expect } from 'vitest'
import {
  averageFinishedMonth, budgetCategoryRows, budgetForMonth, calcBudgetMonth, parseBudgetAmount, suggestedCap,
  type BudgetVersion,
} from './budget'
import { calcSpending } from './spending'
import type { Expense } from '@/types'

const FOOD = '🍽️'
const GROCERIES = '🛒'
const HOME = '🏠'
const TODAY = '2026-11-03'

function expense(amount: number, over: Partial<Expense> = {}): Expense {
  return {
    id: 'e-' + Math.random().toString(36).slice(2),
    group_id: 'g',
    paid_by: 'me',
    amount,
    category: FOOD,
    description: 'test',
    expense_date: '2026-11-02',
    deleted_at: null,
    ...over,
  } as Expense
}

const version = (month: string, cap: number | null, limits: Record<string, number> = {}): BudgetVersion =>
  ({ month, cap, limits })

describe('budgetForMonth', () => {
  const versions = [version('2026-10', 3000), version('2026-07', 3200)]

  it('uses the latest budget starting on or before the month, in any order', () => {
    expect(budgetForMonth(versions, '2026-11')?.cap).toBe(3000)
    expect(budgetForMonth(versions, '2026-10')?.cap).toBe(3000)
    expect(budgetForMonth(versions, '2026-09')?.cap).toBe(3200)
  })

  it('has no budget before the first one', () => {
    expect(budgetForMonth(versions, '2026-06')).toBeNull()
    expect(budgetForMonth([], '2026-11')).toBeNull()
  })

  it('treats an empty version as removal from that month, keeping earlier months', () => {
    const removed = [...versions, version('2026-11', null)]
    expect(budgetForMonth(removed, '2026-11')).toBeNull()
    expect(budgetForMonth(removed, '2026-12')).toBeNull()
    expect(budgetForMonth(removed, '2026-10')?.cap).toBe(3000)
  })

  it('lets a budget return after removal', () => {
    const back = [version('2026-09', 100), version('2026-10', null), version('2026-11', 200)]
    expect(budgetForMonth(back, '2026-10')).toBeNull()
    expect(budgetForMonth(back, '2026-11')?.cap).toBe(200)
  })

  it('accepts limits with no monthly total', () => {
    expect(budgetForMonth([version('2026-11', null, { [FOOD]: 300 })], '2026-11')?.limits[FOOD]).toBe(300)
  })
})

describe('calcBudgetMonth', () => {
  it('reports what is left and a daily amount for the current month', () => {
    const state = calcBudgetMonth([expense(1975)], version('2026-11', 3000), '2026-11', TODAY)
    expect(state.phase).toBe('current')
    expect(state.spent).toBe(1975)
    expect(state.left).toBe(1025)
    expect(state.over).toBe(false)
    expect(state.daysLeft).toBe(27) // November has 30 days
    expect(state.perDay).toBeCloseTo(1025 / 27)
  })

  it('counts full amounts, whoever paid and however it split', () => {
    const shared = expense(200, { paid_by: 'them', splits: [{ id: 's', expense_id: 'x', group_member_id: 'me', owed_amount: 50 }] })
    expect(calcBudgetMonth([shared], version('2026-11', 500), '2026-11', TODAY).spent).toBe(200)
  })

  it('leaves out deleted expenses and other months', () => {
    const rows = [
      expense(100),
      expense(999, { deleted_at: '2026-11-02T00:00:00Z' }),
      expense(999, { expense_date: '2026-10-31' }),
    ]
    expect(calcBudgetMonth(rows, version('2026-11', 500), '2026-11', TODAY).spent).toBe(100)
  })

  it('marks over budget, with no daily amount', () => {
    const state = calcBudgetMonth([expense(3100)], version('2026-11', 3000), '2026-11', TODAY)
    expect(state.over).toBe(true)
    expect(state.left).toBe(-100)
    expect(state.perDay).toBeNull()
  })

  it('is not over at exactly the total', () => {
    const state = calcBudgetMonth([expense(3000)], version('2026-11', 3000), '2026-11', TODAY)
    expect(state.over).toBe(false)
    expect(state.left).toBe(0)
  })

  it('has no daily amount on the last day of the month', () => {
    const state = calcBudgetMonth([expense(10, { expense_date: '2026-11-30' })], version('2026-11', 100), '2026-11', '2026-11-30')
    expect(state.daysLeft).toBe(0)
    expect(state.perDay).toBeNull()
  })

  it('treats finished and future months as such', () => {
    const budget = version('2026-01', 100)
    const past = calcBudgetMonth([], budget, '2026-10', TODAY)
    expect(past.phase).toBe('past')
    expect(past.daysLeft).toBe(0)
    expect(past.perDay).toBeNull()
    expect(calcBudgetMonth([], budget, '2026-12', TODAY).phase).toBe('future')
  })

  it('handles limits with no monthly total', () => {
    const state = calcBudgetMonth([expense(50)], version('2026-11', null, { [FOOD]: 300 }), '2026-11', TODAY)
    expect(state.cap).toBeNull()
    expect(state.left).toBeNull()
    expect(state.fraction).toBeNull()
    expect(state.over).toBe(false)
    expect(state.perDay).toBeNull()
    expect(state.limits[0].left).toBe(250)
  })

  it('tracks each limit, including one with no spending', () => {
    const budget = version('2026-11', 1000, { [FOOD]: 100, [GROCERIES]: 400 })
    const state = calcBudgetMonth([expense(130)], budget, '2026-11', TODAY)
    const food = state.limits.find(l => l.emoji === FOOD)!
    const groceries = state.limits.find(l => l.emoji === GROCERIES)!
    expect(food).toMatchObject({ spent: 130, left: -30, over: true })
    expect(groceries).toMatchObject({ spent: 0, left: 400, over: false, fraction: 0 })
    expect(state.overLimits.map(l => l.emoji)).toEqual([FOOD])
  })

  it('counts an expense with no category toward Other', () => {
    const budget = version('2026-11', null, { '💸': 50 })
    const state = calcBudgetMonth([expense(20, { category: null })], budget, '2026-11', TODAY)
    expect(state.limits[0].spent).toBe(20)
  })
})

describe('budgetCategoryRows', () => {
  it('puts limits first by use, then the rest by size', () => {
    const rows = [
      expense(900, { category: HOME }),
      expense(90, { category: FOOD }),
      expense(40, { category: '🚗' }),
    ]
    const budget = version('2026-11', null, { [FOOD]: 100, [GROCERIES]: 400 })
    const state = calcBudgetMonth(rows, budget, '2026-11', TODAY)
    const out = budgetCategoryRows(calcSpending(rows, '2026-11').categories, state)
    expect(out.map(r => r.category.emoji)).toEqual([FOOD, GROCERIES, HOME, '🚗'])
    expect(out[1].category.total).toBe(0)
    expect(out[1].category.expenses).toEqual([])
    expect(out[2].limit).toBeNull()
  })
})

describe('suggestedCap', () => {
  it('averages finished months, counting empty ones, and rounds up to $100', () => {
    const rows = [
      expense(1000, { expense_date: '2026-08-05' }),
      expense(1100, { expense_date: '2026-10-05' }),
      expense(5000), // this month, still in progress
    ]
    expect(averageFinishedMonth(rows, TODAY)).toBe(700)
    expect(suggestedCap(rows, TODAY)).toBe(700)
    expect(suggestedCap([expense(701, { expense_date: '2026-10-05' })], TODAY)).toBe(800)
  })

  it('has nothing to suggest without a finished month', () => {
    expect(suggestedCap([], TODAY)).toBeNull()
    expect(suggestedCap([expense(100)], TODAY)).toBeNull()
  })
})

describe('parseBudgetAmount', () => {
  it('reads what people type', () => {
    expect(parseBudgetAmount('3000')).toBe(3000)
    expect(parseBudgetAmount(' $3,000.50 ')).toBe(3000.5)
    expect(parseBudgetAmount('19.999')).toBe(20)
  })

  it('rejects anything that can\'t be saved', () => {
    for (const bad of ['', '0', '-5', 'abc', '0.001', '100000000']) {
      expect(parseBudgetAmount(bad)).toBeNull()
    }
  })
})
