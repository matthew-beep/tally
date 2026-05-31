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

export function makePercentSplits(
  expenseId: string,
  amount: number,
  percents: { user_id: string; percent: number }[]
): Omit<ExpenseSplit, 'id'>[] {
  if (percents.length === 0) return []
  const splits = percents.map(p => ({
    expense_id: expenseId,
    user_id: p.user_id,
    owed_amount: Math.round((amount * p.percent / 100) * 100) / 100,
  }))
  // Assign rounding remainder to first person so sum == amount exactly
  const sum  = splits.reduce((a, s) => a + s.owed_amount, 0)
  const diff = Math.round((amount - sum) * 100) / 100
  if (diff !== 0) splits[0].owed_amount = Math.round((splits[0].owed_amount + diff) * 100) / 100
  return splits
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
