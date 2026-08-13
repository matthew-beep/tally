'use client'

import { T } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { Card } from '@/components/Card'
import { FeedCard } from '@/components/feed/FeedCard'
import { toActivityCard } from '@/lib/feedCards'
import { useAllActivity } from '@/queries/useActivity'
import { useRouter } from 'next/navigation'
import type { ActivityItem } from '@/types'

// Same as group detail: month-bucket by expense_date / settled_date, while
// the feed itself stays sorted by created_at (useAllActivity / mergeFeed).
function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function bucketByMonth(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const order: string[] = []
  const byLabel: Record<string, ActivityItem[]> = {}
  for (const item of items) {
    const label = monthLabel(item.date)
    if (!byLabel[label]) { byLabel[label] = []; order.push(label) }
    byLabel[label].push(item)
  }
  return order.map(label => ({ label, items: byLabel[label] }))
}

export default function ActivityPage() {
  const router = useRouter()
  const { data: items = [], isLoading } = useAllActivity()
  const buckets = bucketByMonth(items)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <AppHeader title="Activity" />
      <DashboardPage>
        {isLoading && (
          <div style={{ color: T.inkMuted, fontSize: 14 }}>Loading…</div>
        )}

        {!isLoading && items.length === 0 && (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T.inkMuted }}>No activity yet. Join or create a group to get started.</div>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {buckets.map(({ label, items: monthItems }) => (
            <div key={label}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted, marginBottom: 10 }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {monthItems.map(item => (
                  <FeedCard
                    key={item.id}
                    size="compact"
                    model={{
                      ...toActivityCard(item, true),
                      onClick: () => router.push(`/groups/${item.groupId}`),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardPage>
    </div>
  )
}
