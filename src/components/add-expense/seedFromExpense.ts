import { round2 } from '@/lib/money'
import type { Expense } from '@/types'
import type { SplitMode } from './types'

/** The add-expense form's starting values when it opens to edit `expense`. */
export interface FormSeed {
  amount: string
  description: string
  category: string
  expenseDate: string
  paidById: string
  /** Itemized opens as exact — receipt items were never saved, only the per-person totals. */
  splitMode: Exclude<SplitMode, 'itemized'>
  included: Set<string>
  exactAmounts: Record<string, string>
  percents: Record<string, string>
}

/**
 * Turn a saved expense back into form state. Both the exact and percent maps
 * are filled from the saved shares regardless of split type, so switching
 * mode mid-edit starts from what people actually owe rather than an even
 * split.
 *
 * Percents are derived (only dollar amounts are stored), so rounding to one
 * decimal can drift off 100. The rows are re-balanced to exactly 100 by
 * putting the leftover on the largest one.
 *
 * Only members with a nonzero share are included — the payer too. A payer
 * with no share (or an old $0.00 row) fronted it for the others, and opening
 * the edit shouldn't quietly tick them back in.
 */
export function seedFromExpense(expense: Expense): FormSeed {
  const amount = Number(expense.amount)
  const splits = expense.splits ?? []

  const exactAmounts: Record<string, string> = {}
  const rawPercents: Record<string, number> = {}
  for (const s of splits) {
    const owed = Number(s.owed_amount)
    exactAmounts[s.group_member_id] = owed.toFixed(2)
    rawPercents[s.group_member_id] = amount > 0 ? (owed / amount) * 100 : 0
  }

  const editable = splits
    .filter(s => Number(s.owed_amount) > 0)
    .map(s => s.group_member_id)
  const round1 = (n: number) => Math.round(n * 10) / 10
  const target = 100

  const percentNums: Record<string, number> = {}
  for (const id of Object.keys(rawPercents)) percentNums[id] = round1(rawPercents[id])
  if (editable.length > 0) {
    const sum = editable.reduce((a, id) => a + percentNums[id], 0)
    const leftover = round1(target - sum)
    if (leftover !== 0) {
      const largest = editable.reduce((a, id) => (percentNums[id] > percentNums[a] ? id : a), editable[0])
      percentNums[largest] = round1(percentNums[largest] + leftover)
    }
  }
  const percents = Object.fromEntries(
    Object.entries(percentNums).map(([id, p]) => [id, String(round2(p))]),
  )

  return {
    amount: amount.toFixed(2),
    description: expense.description,
    category: expense.category ?? '💸',
    expenseDate: expense.expense_date,
    paidById: expense.paid_by,
    splitMode: expense.split_type === 'itemized' ? 'exact' : expense.split_type,
    included: new Set(editable),
    exactAmounts,
    percents,
  }
}
