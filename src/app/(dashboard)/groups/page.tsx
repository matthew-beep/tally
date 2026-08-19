'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, FH, FMONO, CONTENT_MAX_WIDTH } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { Card, CardChevron } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { AvatarStack } from '@/components/Avatar'
import { avatarProfile, displayName, slotFor } from '@/lib/memberDisplay'
import { splitAmount } from '@/lib/money'
import { useGroups } from '@/queries/useGroups'
import { useGlobalBalances } from '@/queries/useGlobalBalances'
import type { GroupMember } from '@/types'

export default function GroupsPage() {
  const router = useRouter()
  const { data: groups = [], isLoading } = useGroups()
  const { data: gb } = useGlobalBalances()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? groups.filter(g => {
        if (g.name.toLowerCase().includes(q)) return true
        const members = gb?.membersPerGroup?.[g.id] ?? []
        return members.some(m => displayName(m).toLowerCase().includes(q))
      })
    : groups

  const { owed, owe } = groups.reduce(
    (acc, g) => {
      const net = gb?.myId ? gb.netPerGroup[g.id]?.[gb.myId] ?? 0 : 0
      if (net > 0) acc.owed += net
      else if (net < 0) acc.owe += -net
      return acc
    },
    { owed: 0, owe: 0 }
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <AppHeader title="Groups" />
      <DashboardPage maxWidth={CONTENT_MAX_WIDTH}>
        {!isLoading && groups.length > 0 && (
          <GroupsSummary owed={owed} owe={owe} groupCount={groups.length} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: T.surface, borderRadius: 11, padding: '10px 14px', boxShadow: `inset 0 0 0 1px ${T.line}` }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="5.2" stroke={T.inkFaint} strokeWidth="1.6" />
              <path d="M12 12l3.4 3.4" stroke={T.inkFaint} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              className="groups-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search groups"
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 13.5, fontWeight: 500, color: T.ink }}
            />
          </div>
          <Btn
            onClick={() => router.push('/groups/new')} variant="dark" size="md"
            style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0 }}
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

        {!isLoading && groups.length > 0 && filtered.length === 0 && (
          <Card style={{ padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T.inkMuted }}>No groups match “{query.trim()}”</div>
          </Card>
        )}

        {!isLoading && filtered.length > 0 && (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: T.inkFaint, margin: '4px 2px 10px' }}>
              {filtered.length} {filtered.length === 1 ? 'group' : 'groups'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(g => (
                <GroupRow
                  key={g.id}
                  group={g}
                  myId={gb?.myId}
                  netPerGroup={gb?.netPerGroup}
                  membersPerGroup={gb?.membersPerGroup}
                />
              ))}
            </div>
          </>
        )}
      </DashboardPage>
    </div>
  )
}

function GroupsSummary({ owed, owe, groupCount }: { owed: number; owe: number; groupCount: number }) {
  return (
    <>
      {/* Mobile — two cards: owed to you / you owe, no group count */}
      <div className="groups-summary-mobile">
        <Card tone="elevated" style={{ flex: 1, padding: '16px 18px' }}>
          <SummaryCell label="You’re owed" amount={owed} color={T.mintInk} sign="+" />
        </Card>
        <Card tone="elevated" style={{ flex: 1, padding: '16px 18px' }}>
          <SummaryCell label="You owe" amount={owe} color={T.coralInk} sign="−" />
        </Card>
      </div>

      {/* Desktop — one strip, three cells divided by hairlines */}
      <Card tone="elevated" className="groups-summary-desktop" style={{ gap: 14, padding: '18px 32px' }}>
        <SummaryCell label="You’re owed" amount={owed} color={T.mintInk} sign="+" />
        <div style={{ width: 1, background: T.line, alignSelf: 'stretch' }} />
        <SummaryCell label="You owe" amount={owe} color={T.coralInk} sign="−" />
        <div style={{ width: 1, background: T.line, alignSelf: 'stretch' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkFaint }}>Active groups</div>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: T.ink, marginTop: 4 }}>{groupCount}</div>
        </div>
      </Card>
    </>
  )
}

function SummaryCell({ label, amount, color, sign }: { label: string; amount: number; color: string; sign: '+' | '−' }) {
  const { whole, cents } = splitAmount(amount)
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkFaint }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color, marginTop: 4 }}>
        <span style={{ opacity: 0.7 }}>{sign}$</span>{whole}
        <span style={{ fontFamily: FMONO, fontSize: 14, opacity: 0.6 }}>{cents}</span>
      </div>
    </div>
  )
}

function GroupRow({ group, myId, netPerGroup, membersPerGroup }: {
  group: { id: string; name: string; emoji: string }
  myId?: string
  netPerGroup?: Record<string, Record<string, number>>
  membersPerGroup?: Record<string, GroupMember[]>
}) {
  const router = useRouter()
  const members = membersPerGroup?.[group.id] ?? []
  const myBalance = myId && netPerGroup ? (netPerGroup[group.id]?.[myId] ?? 0) : 0

  const avatarItems = members.map(m => ({
    profile: avatarProfile(m),
    slot: slotFor(members, m.id),
    isYou: m.user_id === myId,
  }))

  return (
    <Card
      hoverable
      onClick={() => router.push(`/groups/${group.id}`)}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px' }}
    >
      <span style={{
        width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: T.surfaceAlt,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 23,
        boxShadow: `inset 0 0 0 1px ${T.line}`,
      }}>
        {group.emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 5, overflow: 'hidden' }}>
          <span className="group-row-members-text" style={{ fontSize: 11.5, color: T.inkFaint }}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
          <div className="group-row-avatars">
            <AvatarStack members={avatarItems} size={20} max={4} overlap={0.4} />
          </div>
        </div>
      </div>
      <GroupRowAmount amount={myBalance} />
      <CardChevron />
    </Card>
  )
}

function GroupRowAmount({ amount }: { amount: number }) {
  const settled = Math.abs(amount) < 0.01
  const pos = amount > 0
  const { whole, cents } = splitAmount(amount)

  return (
    <div style={{ minWidth: 118, textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.inkFaint }}>
        {settled ? 'settled up' : pos ? "you're owed" : 'you owe'}
      </div>
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.4, color: settled ? T.inkFaint : pos ? T.mintInk : T.coralInk, marginTop: 2 }}>
        {settled ? (
          '$0.00'
        ) : (
          <>
            <span style={{ opacity: 0.5 }}>{pos ? '+' : '−'}$</span>
            {whole}
            <span style={{ fontFamily: FMONO, fontSize: 12, opacity: 0.6 }}>{cents}</span>
          </>
        )}
      </div>
    </div>
  )
}
