'use client'

import { useRouter } from 'next/navigation'
import { T, FH, FMONO } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { Card } from '@/components/Card'
import { EmojiTile } from '@/components/EmojiTile'
import { Btn } from '@/components/Btn'
import { AvatarStack } from '@/components/Avatar'
import { avatarProfile, slotFor } from '@/lib/memberDisplay'
import { splitAmount } from '@/lib/money'
import { useGroups } from '@/queries/useGroups'
import { useGlobalBalances } from '@/queries/useGlobalBalances'
import type { GroupMember } from '@/types'

export default function GroupsPage() {
  const router = useRouter()
  const { data: groups = [], isLoading } = useGroups()
  const { data: gb } = useGlobalBalances()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <AppHeader title="Groups" />
      <DashboardPage>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <Btn
            onClick={() => router.push('/groups/new')} variant="dark" size="md"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            + New group
          </Btn>
        </div>

        {isLoading && <div style={{ color: T.inkMuted, fontSize: 14 }}>Loading…</div>}

        {!isLoading && groups.length === 0 && (
          <Card style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No groups yet</div>
            <div style={{ fontSize: 13, color: T.inkMuted, marginBottom: 20 }}>Create a group and start splitting expenses with friends.</div>
            <Btn
              onClick={() => router.push('/groups/new')} variant="dark" size="md"
              style={{ padding: '11px 24px', fontSize: 14 }}
            >
              Create your first group
            </Btn>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(g => (
            <GroupCard key={g.id} group={g} myId={gb?.myId} netPerGroup={gb?.netPerGroup} membersPerGroup={gb?.membersPerGroup} />
          ))}
        </div>
      </DashboardPage>
    </div>
  )
}

function GroupCard({ group, myId, netPerGroup, membersPerGroup }: {
  group: { id: string; name: string; emoji: string }
  myId?: string
  netPerGroup?: Record<string, Record<string, number>>
  membersPerGroup?: Record<string, GroupMember[]>
}) {
  const router = useRouter()
  const members = membersPerGroup?.[group.id] ?? []
  const myBalance = myId && netPerGroup ? (netPerGroup[group.id]?.[myId] ?? 0) : 0
  const square = Math.abs(myBalance) < 0.01

  const avatarItems = members.map(m => ({
    profile: avatarProfile(m),
    slot: slotFor(members, m.id),
    isYou: m.user_id === myId,
  }))

  return (
    <Card
      hoverable
      onClick={() => router.push(`/groups/${group.id}`)}
      style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
    >
      <EmojiTile emoji={group.emoji} size={46} fontSize={24} radius={15} background={T.bg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>{group.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
          <AvatarStack members={avatarItems} size={18} max={4} overlap={0.4} />
          <span style={{ fontSize: 11, color: T.inkMuted }}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>
      </div>
      {square ? (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkMuted, padding: '4px 11px', background: T.bg, borderRadius: T.r.pill, flexShrink: 0 }}>
          square ✓
        </div>
      ) : (
        <GroupCardAmount amount={myBalance} />
      )}
    </Card>
  )
}

function GroupCardAmount({ amount }: { amount: number }) {
  const pos = amount > 0
  const { whole, cents } = splitAmount(amount)

  return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.5, color: pos ? T.mintInk : T.coralInk }}>
        <span style={{ opacity: 0.5 }}>{pos ? '+' : '−'}$</span>
        {whole}
        <span style={{ fontFamily: FMONO, fontSize: 13, opacity: 0.6 }}>{cents}</span>
      </div>
      <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 1 }}>{pos ? "you're owed" : 'you owe'}</div>
    </div>
  )
}
