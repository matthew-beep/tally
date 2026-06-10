'use client'

import { useRouter } from 'next/navigation'
import { T, FH, F } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { BalanceBadge } from '@/components/BalanceBadge'
import { useGroups } from '@/queries/useGroups'
import { useGlobalBalances } from '@/queries/useGlobalBalances'
import type { Profile } from '@/types'

export default function GroupsPage() {
  const router = useRouter()
  const { data: groups = [], isLoading } = useGroups()
  const { data: gb } = useGlobalBalances()

  console.log("gb", gb)
  console.log("groups", groups)

  return (
    <DashboardPage>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5 }}>Groups</div>
          <button
            onClick={() => router.push('/groups/new')}
            style={{ background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F }}
          >
            + New group
          </button>
        </div>

        {isLoading && <div style={{ color: T.inkMuted, fontSize: 14 }}>Loading…</div>}

        {!isLoading && groups.length === 0 && (
          <Card style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No groups yet</div>
            <div style={{ fontSize: 13, color: T.inkMuted, marginBottom: 20 }}>Create a group and start splitting expenses with friends.</div>
            <button
              onClick={() => router.push('/groups/new')}
              style={{ background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F }}
            >
              Create your first group
            </button>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(g => (
            <GroupCard key={g.id} group={g} myId={gb?.myId} netPerGroup={gb?.netPerGroup} membersPerGroup={gb?.membersPerGroup} />
          ))}
        </div>
    </DashboardPage>
  )
}

function GroupCard({ group, myId, netPerGroup, membersPerGroup }: {
  group: { id: string; name: string; emoji: string }
  myId?: string
  netPerGroup?: Record<string, Record<string, number>>
  membersPerGroup?: Record<string, Array<{ user_id: string; profile: Profile }>>
}) {
  const router = useRouter()
  const members = membersPerGroup?.[group.id] ?? []
  const myBalance = myId && netPerGroup ? (netPerGroup[group.id]?.[myId] ?? 0) : 0

  return (
    <Card
      hoverable
      onClick={() => router.push(`/groups/${group.id}`)}
      style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <div style={{ fontSize: 24, width: 44, height: 44, background: T.bg, borderRadius: T.r.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {group.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FH }}>{group.name}</div>
        <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </div>
      </div>
      <BalanceBadge amount={myBalance} />
    </Card>
  )
}
