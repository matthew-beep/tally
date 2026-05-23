import type { ExpenseSplit } from '@/types'

export function makeEqualSplits(
  expenseId: string,
  amount: number,
  memberIds: string[]
): Omit<ExpenseSplit, 'id'>[] {
  if (memberIds.length === 0) return []
  const base = Math.floor((amount / memberIds.length) * 100) / 100
  const remainder = Math.round((amount - base * memberIds.length) * 100) / 100

  return memberIds.map((uid, i) => ({
    expense_id: expenseId,
    user_id: uid,
    owed_amount: i === 0 ? Math.round((base + remainder) * 100) / 100 : base,
  }))
}

export function makeExactSplits(
  expenseId: string,
  splits: { user_id: string; owed_amount: number }[]
): Omit<ExpenseSplit, 'id'>[] {
  return splits.map(s => ({
    expense_id: expenseId,
    user_id: s.user_id,
    owed_amount: Math.round(s.owed_amount * 100) / 100,
  }))
}
