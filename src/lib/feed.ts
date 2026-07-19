import type { Expense, Settlement } from '@/types'

export type FeedItem =
  | { type: 'expense'; data: Expense }
  | { type: 'settlement'; data: Settlement }

// One timeline, newest first. Sort key is created_at — a backdated expense
// (old expense_date, logged today) still surfaces at the top. Bucketing
// (by month, by group) is the consumer's job, not mergeFeed's.
export function mergeFeed(expenses: Expense[], settlements: Settlement[]): FeedItem[] {
  return [
    ...expenses.filter(e => !e.deleted_at).map(e => ({ type: 'expense' as const, data: e })),
    ...settlements.map(s => ({ type: 'settlement' as const, data: s })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
}
