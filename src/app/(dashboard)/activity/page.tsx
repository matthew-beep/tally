'use client'

import { T, FH } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { ActivityRow } from '@/components/ActivityRow'
import { useAllActivity } from '@/queries/useActivity'
import { useRouter } from 'next/navigation'

export default function ActivityPage() {
  const router = useRouter()
  const { data: groups = [], isLoading } = useAllActivity()

  return (
    <DashboardPage>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, marginBottom: 24 }}>Activity</div>

      {isLoading && (
        <div style={{ color: T.inkMuted, fontSize: 14 }}>Loading…</div>
      )}

      {!isLoading && groups.length === 0 && (
        <Card style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: T.inkMuted }}>No activity yet. Join or create a group to get started.</div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groups.map(({ group, items }) => (
          <div key={group.id}>
            <div
              onClick={() => router.push(`/groups/${group.id}`)}
              style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted, marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>{group.emoji}</span>
              <span>{group.name}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardPage>
  )
}
