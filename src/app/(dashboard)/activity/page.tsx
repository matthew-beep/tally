'use client'

import { T, FH, FMONO } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { useGroups, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements } from '@/queries/useSettlements'
import { useRouter } from 'next/navigation'

export default function ActivityPage() {
  const { data: groups = [] } = useGroups()

  return (
    <DashboardPage>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, marginBottom: 24 }}>Activity</div>
        {groups.map(g => (
          <GroupActivity key={g.id} group={g} />
        ))}
        {groups.length === 0 && (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T.inkMuted }}>No activity yet. Join or create a group to get started.</div>
          </Card>
        )}
    </DashboardPage>
  )
}

function GroupActivity({ group }: { group: { id: string; name: string; emoji: string } }) {
  const router = useRouter()
  const { data: expenses = [] } = useExpenses(group.id)
  const { data: settlements = [] } = useSettlements(group.id)
  const { data: members = [] } = useGroupMembers(group.id)

  const profileById = Object.fromEntries(
    members.map(m => [(m as any).profile?.id, (m as any).profile])
  )

  const feed = [
    ...expenses.map(e => ({ ...e, _type: 'expense' as const, _sort: e.created_at })),
    ...settlements.map(s => ({ ...s, _type: 'settlement' as const, _sort: s.created_at })),
  ].sort((a, b) => new Date(b._sort).getTime() - new Date(a._sort).getTime()).slice(0, 10)

  if (feed.length === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        onClick={() => router.push(`/groups/${group.id}`)}
        style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted, marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span>{group.emoji}</span>
        <span>{group.name}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {feed.map(item => {
          if (item._type === 'expense') {
            const e = item as any
            return (
              <Card key={e.id} style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 18, width: 32, height: 32, background: T.bg, borderRadius: T.r.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {e.category ?? '💸'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.description}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted }}>{new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <div style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 600 }}>${Number(e.amount).toFixed(2)}</div>
              </Card>
            )
          }
          const s = item as any
          return (
            <Card key={s.id} style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', background: s.status === 'confirmed' ? T.mintSoft : T.surface }}>
              <div style={{ fontSize: 16 }}>{s.status === 'confirmed' ? '✓' : '⏳'}</div>
              <div style={{ flex: 1, fontSize: 12, color: T.inkMuted }}>Payment recorded</div>
              <div style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 600, color: s.status === 'confirmed' ? T.mintInk : T.ink }}>${Number(s.amount).toFixed(2)}</div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
