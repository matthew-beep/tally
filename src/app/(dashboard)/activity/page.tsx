'use client'

import { useMemo, useState } from 'react'
import { T, CONTENT_MAX_WIDTH } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { Card } from '@/components/Card'
import { Token } from '@/components/PersonToken'
import { FeedCard } from '@/components/feed/FeedCard'
import { toActivityCard } from '@/lib/feedCards'
import { bucketActivity } from '@/lib/feed'
import { useAllActivity } from '@/queries/useActivity'
import { useRouter } from 'next/navigation'
import type { ActivityItem } from '@/types'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'settlement', label: 'Payments' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

export default function ActivityPage() {
  const router = useRouter()
  const { data: items = [], isLoading } = useAllActivity()
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i: ActivityItem) => i.type === filter)),
    [items, filter]
  )
  const buckets = bucketActivity(filtered)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <AppHeader title="Activity" />
      <DashboardPage maxWidth={CONTENT_MAX_WIDTH}>
        {isLoading && (
          <div style={{ color: T.inkMuted, fontSize: 14 }}>Loading…</div>
        )}

        {!isLoading && items.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {FILTERS.map(f => (
              <Token key={f.key} size="sm" selected={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </Token>
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T.inkMuted }}>No activity yet. Join or create a group to get started.</div>
          </Card>
        )}

        {!isLoading && items.length > 0 && filtered.length === 0 && (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T.inkMuted }}>No {FILTERS.find(f => f.key === filter)?.label.toLowerCase()} yet.</div>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {buckets.map(({ label, items: bucketItems }) => (
            <div key={label}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted, marginBottom: 10 }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bucketItems.map(item => (
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
