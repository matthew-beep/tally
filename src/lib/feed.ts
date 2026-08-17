import type { ActivityItem, Expense, Settlement } from '@/types'

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

export interface ActivityBucket {
  label: string
  items: ActivityItem[]
}

// Buckets an already-sorted ActivityItem list (see useAllActivity) into
// day-relative labels for the near term, falling back to month labels
// beyond that — the Activity tab wants "Today"/"Yesterday" resolution for
// recent items, not just a month heading. `today` is injectable for tests.
export function bucketActivity(items: ActivityItem[], today: Date = new Date()): ActivityBucket[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  function label(dateStr: string): string {
    // Midnight-qualified so a bare YYYY-MM-DD isn't read as UTC and bucketed a day early.
    const d = new Date(dateStr + 'T00:00:00')
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays > 1 && diffDays < 7) return 'Earlier this week'
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const order: string[] = []
  const byLabel: Record<string, ActivityItem[]> = {}
  for (const item of items) {
    const l = label(item.date)
    if (!byLabel[l]) { byLabel[l] = []; order.push(l) }
    byLabel[l].push(item)
  }
  return order.map(l => ({ label: l, items: byLabel[l] }))
}
