import { round2 } from '@/lib/money'
import type { ExpenseSplit } from '@/types'

// Split sum invariant: every builder here returns rows summing exactly to the
// expense total. The leftover cent goes to the payer's row (convention: the
// person who fronted the money absorbs rounding). `payerId` is optional only
// for callers that genuinely have no payer context — they fall back to row 0.
function absorbRemainder<T extends { group_member_id: string; owed_amount: number }>(
  splits: T[],
  amount: number,
  payerId?: string
): T[] {
  if (splits.length === 0) return splits
  const diff = round2(amount - splits.reduce((a, s) => a + s.owed_amount, 0))
  if (diff === 0) return splits
  const target = (payerId && splits.find(s => s.group_member_id === payerId)) || splits[0]
  target.owed_amount = round2(target.owed_amount + diff)
  return splits
}

export function makeEqualSplits(
  expenseId: string,
  amount: number,
  memberIds: string[],
  payerId?: string
): Omit<ExpenseSplit, 'id'>[] {
  if (memberIds.length === 0) return []
  const base = Math.floor((amount / memberIds.length) * 100) / 100

  return absorbRemainder(
    memberIds.map(gmId => ({
      expense_id: expenseId,
      group_member_id: gmId,
      owed_amount: base,
    })),
    amount,
    payerId
  )
}

export function makePercentSplits(
  expenseId: string,
  amount: number,
  percents: { group_member_id: string; percent: number }[],
  payerId?: string
): Omit<ExpenseSplit, 'id'>[] {
  if (percents.length === 0) return []

  return absorbRemainder(
    percents.map(p => ({
      expense_id: expenseId,
      group_member_id: p.group_member_id,
      owed_amount: round2(amount * p.percent / 100),
    })),
    amount,
    payerId
  )
}

// Proportionally rescale existing splits to a new expense amount.
// Rounding remainder goes to the payer's row so the sum stays exact.
export function rescaleSplits(
  splits: { group_member_id: string; owed_amount: number }[],
  newAmount: number,
  payerId: string
): { group_member_id: string; owed_amount: number }[] {
  const roundedAmount = round2(newAmount)
  const oldTotal = splits.reduce((a, s) => a + Number(s.owed_amount), 0)
  const ratio = roundedAmount / oldTotal

  return absorbRemainder(
    splits.map(s => ({
      group_member_id: s.group_member_id,
      owed_amount: round2(Number(s.owed_amount) * ratio),
    })),
    roundedAmount,
    payerId
  )
}

export function makeExactSplits(
  expenseId: string,
  splits: { group_member_id: string; owed_amount: number }[]
): Omit<ExpenseSplit, 'id'>[] {
  return splits.map(s => ({
    expense_id: expenseId,
    group_member_id: s.group_member_id,
    owed_amount: round2(s.owed_amount),
  }))
}
