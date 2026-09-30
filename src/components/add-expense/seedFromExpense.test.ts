import { describe, it, expect } from 'vitest'
import { seedFromExpense } from './seedFromExpense'
import type { Expense } from '@/types'

function expense(over: Partial<Expense> & Pick<Expense, 'amount' | 'split_type' | 'splits'>): Expense {
  return {
    id: 'e1', group_id: 'g1', paid_by: 'a', description: 'Dinner', category: '🍽️',
    tax: 0, tip: 0, expense_date: '2026-09-20', created_at: '', updated_at: '',
    share_token: null, deleted_at: null,
    ...over,
  }
}

const split = (group_member_id: string, owed_amount: number) =>
  ({ id: group_member_id, expense_id: 'e1', group_member_id, owed_amount })

const pctSum = (p: Record<string, string>, ids: string[]) =>
  Math.round(ids.reduce((a, id) => a + parseFloat(p[id]), 0) * 10) / 10

describe('seedFromExpense', () => {
  it('round-trips an equal expense', () => {
    const seed = seedFromExpense(expense({
      amount: 30, split_type: 'equal', splits: [split('a', 10), split('b', 10), split('c', 10)],
    }), false)
    expect(seed).toMatchObject({
      amount: '30.00', description: 'Dinner', category: '🍽️', expenseDate: '2026-09-20',
      paidById: 'a', splitMode: 'equal',
    })
    expect([...seed.included].sort()).toEqual(['a', 'b', 'c'])
    expect(seed.exactAmounts).toEqual({ a: '10.00', b: '10.00', c: '10.00' })
  })

  it('derives percents that sum to exactly 100 across every row on desktop', () => {
    const seed = seedFromExpense(expense({
      amount: 10, split_type: 'percentage', splits: [split('a', 3.34), split('b', 3.33), split('c', 3.33)],
    }), false)
    expect(pctSum(seed.percents, ['a', 'b', 'c'])).toBe(100)
  })

  it('on mobile balances only the non-payer rows, to their true share', () => {
    const seed = seedFromExpense(expense({
      amount: 30, split_type: 'percentage', splits: [split('a', 10), split('b', 10), split('c', 10)],
    }), true)
    // b + c own 66.67% of the bill; rounded to one decimal each that's 33.3 + 33.3,
    // re-balanced to 66.7.
    expect(pctSum(seed.percents, ['b', 'c'])).toBe(66.7)
  })

  it('opens an itemized expense in exact mode with the saved amounts', () => {
    const seed = seedFromExpense(expense({
      amount: 42.5, split_type: 'itemized', splits: [split('a', 20), split('b', 22.5)],
    }), false)
    expect(seed.splitMode).toBe('exact')
    expect(seed.exactAmounts).toEqual({ a: '20.00', b: '22.50' })
  })

  it('always includes the payer, even without a split row', () => {
    const seed = seedFromExpense(expense({
      amount: 20, paid_by: 'a', split_type: 'exact', splits: [split('b', 20)],
    }), false)
    expect(seed.included.has('a')).toBe(true)
  })

  it('falls back to the default category when none was saved', () => {
    const seed = seedFromExpense(expense({
      amount: 5, category: null, split_type: 'equal', splits: [split('a', 5)],
    }), false)
    expect(seed.category).toBe('💸')
  })
})
