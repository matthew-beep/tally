'use client'

import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Card } from '@/components/Card'
import { BalanceBadge } from '@/components/BalanceBadge'
import { useCurrentProfile } from '@/queries/useProfile'
import { useGroups, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements } from '@/queries/useSettlements'
import { useGlobalBalances, useRecentActivity } from '@/queries/useGlobalBalances'
import { calcNetBalances } from '@/lib/balance'
import type { Profile } from '@/types'
import { useUIStore } from '@/store/ui'

function AmtText({ amount, size = 15 }: { amount: number; size?: number }) {
  const sign  = amount >= 0 ? '+' : '−'
  const abs   = Math.abs(amount)
  const whole = Math.floor(abs).toLocaleString()
  const cents = (abs % 1).toFixed(2).slice(1)
  const color = amount >= 0 ? T.mintInk : T.coralInk
  return (
    <span style={{ fontFamily: FH, fontWeight: 700, fontSize: size, color, letterSpacing: -0.5 }}>
      <span style={{ opacity: 0.6 }}>{sign}$</span>
      {whole}
      <span style={{ fontFamily: FMONO, fontSize: size * 0.72, opacity: 0.7 }}>{cents}</span>
    </span>
  )
}

function TopBar() {
  const router = useRouter()
  const { data: profile } = useCurrentProfile()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="home-topbar" style={{ borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 10, background: T.bg }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Home</div>
        <div className="home-topbar-greeting" style={{ fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, color: T.ink, marginTop: 1 }}>
          {greeting}{profile ? ` ${(profile.display_name ?? profile.name).split(' ')[0]}` : ''}
        </div>
      </div>
      <div className="home-topbar-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => router.push('/groups/new')}
          className="home-topbar-add"
          style={{ background: T.ink, border: 'none', borderRadius: T.r.md, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: T.bg, fontFamily: F, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span className="home-topbar-add-label">New group</span>
          <span className="home-topbar-add-icon">+</span>
        </button>
        <div onClick={() => router.push('/me')} style={{ cursor: 'pointer' }}>
          <Avatar profile={profile ?? undefined} slot={0} size={34} isYou />
        </div>
      </div>
    </div>
  )
}

function HeroRow() {
  const { data: gb, isLoading } = useGlobalBalances()
  const myId = gb?.myId

  if (isLoading || !gb || !myId) {
    return (
      <div className="home-hero">
        <div className="home-hero-balance" style={{ background: T.surface, borderRadius: T.r.xl, padding: '22px 22px 20px', boxShadow: T.shadowSm, minHeight: 100 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted }}>Net balance</div>
          <div style={{ marginTop: 10, color: T.inkFaint, fontSize: 13 }}>Loading…</div>
        </div>
      </div>
    )
  }

  const total      = Math.round((gb.net[myId] ?? 0) * 100) / 100
  const isPositive = total >= 0
  const whole      = Math.floor(Math.abs(total)).toLocaleString()
  const cents      = (Math.abs(total) % 1).toFixed(2).slice(1)
  const sign       = total >= 0 ? '+' : '−'

  const owedToYou = gb.transfers.filter(t => t.to === myId).map(t => ({ profile: gb.profileMap[t.from], amount: t.amount }))
  const youOwe    = gb.transfers.filter(t => t.from === myId).map(t => ({ profile: gb.profileMap[t.to], amount: t.amount }))

  return (
    <div className="home-hero">
      <div className="home-hero-balance" style={{ background: T.surface, borderRadius: T.r.xl, padding: '22px 22px 20px', boxShadow: T.shadowSm, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: isPositive ? T.mintSoft : T.coralSoft, opacity: 0.6 }} />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 10 }}>Net balance</div>
        <div style={{ lineHeight: 1, marginBottom: 6, color: isPositive ? T.mintInk : T.coralInk }}>
          <span className="home-balance-sign" style={{ fontFamily: FH, fontSize: 22, fontWeight: 500, opacity: 0.7 }}>{sign}$</span>
          <span className="home-balance-whole" style={{ fontFamily: FH, fontSize: 44, fontWeight: 700, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
          <span style={{ fontFamily: FMONO, fontSize: 13, opacity: 0.7 }}>{cents}</span>
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted }}>
          {isPositive ? 'Overall you are owed' : 'Overall you owe'} across all groups
        </div>
      </div>

      <div style={{ background: T.surface, borderRadius: T.r.lg, padding: '20px 20px 16px', boxShadow: T.shadowSm }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.mintInk, marginBottom: 12 }}>Owed to you</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {owedToYou.length === 0
            ? <div style={{ fontSize: 13, color: T.inkFaint }}>Nothing owed to you</div>
            : owedToYou.slice(0, 4).map(({ profile, amount }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar profile={profile} slot={(i + 1) % 4 as 0 | 1 | 2 | 3} size={28} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.ink }}>{profile?.display_name ?? profile?.name ?? '…'}</span>
                <AmtText amount={amount} size={14} />
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ background: T.surface, borderRadius: T.r.lg, padding: '20px 20px 16px', boxShadow: T.shadowSm }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.coralInk, marginBottom: 12 }}>You owe</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {youOwe.length === 0
            ? <div style={{ fontSize: 13, color: T.inkFaint }}>You owe nothing</div>
            : youOwe.slice(0, 4).map(({ profile, amount }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar profile={profile} slot={(i + 2) % 4 as 0 | 1 | 2 | 3} size={28} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.ink }}>{profile?.display_name ?? profile?.name ?? '…'}</span>
                <AmtText amount={-amount} size={14} />
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

function GroupCard({ group, myId }: { group: { id: string; name: string; emoji: string }; myId?: string }) {
  const router = useRouter()
  const { data: members     = [] } = useGroupMembers(group.id)
  const { data: expenses    = [] } = useExpenses(group.id)
  const { data: settlements = [] } = useSettlements(group.id)

  const memberIds = members.map(m => m.user_id)
  const net   = myId ? calcNetBalances(group.id, expenses, settlements, memberIds) : {}
  const myBal = myId ? (net[myId] ?? 0) : 0

  return (
    <Card hoverable onClick={() => router.push(`/groups/${group.id}`)} style={{ padding: '16px 18px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: T.r.md, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          {group.emoji}
        </div>
        <BalanceBadge amount={myBal} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: T.ink, marginBottom: 3 }}>{group.name}</div>
      <div style={{ fontSize: 12, color: T.inkMuted }}>{members.length} {members.length === 1 ? 'person' : 'people'}</div>
      <div style={{ display: 'flex', marginTop: 12 }}>
        {members.slice(0, 4).map((m, i) => (
          <div key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
            <Avatar profile={(m as any).profile as Profile} slot={i % 4 as 0 | 1 | 2 | 3} size={22} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function GroupsPanel() {
  const router = useRouter()
  const { data: groups = [], isLoading } = useGroups()
  const { data: gb } = useGlobalBalances()

  return (
    <div className="home-groups-panel">
      <div className="home-groups-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted }}>Groups</div>
        <button
          onClick={() => router.push('/groups/new')}
          style={{ background: T.ink, border: 'none', borderRadius: T.r.md, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: T.bg, fontFamily: F, cursor: 'pointer' }}
        >
          New group +
        </button>
      </div>

      {isLoading && <div style={{ fontSize: 13, color: T.inkFaint }}>Loading…</div>}

      {!isLoading && groups.length === 0 && (
        <div style={{ borderRadius: T.r.lg, padding: '24px 20px', border: `2px dashed ${T.lineStrong}`, textAlign: 'center', color: T.inkMuted }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>No groups yet</div>
          <div style={{ fontSize: 12, color: T.inkFaint }}>Create a group and start splitting expenses.</div>
        </div>
      )}

      <div className="home-groups-grid">
        {groups.map(g => <GroupCard key={g.id} group={g} myId={gb?.myId} />)}
      </div>
    </div>
  )
}

function ActivityPanel() {
  const { data: items = [], isLoading } = useRecentActivity()

  return (
    <div className="home-activity-panel">
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted, marginBottom: 12 }}>
        Recent activity
      </div>
      {isLoading && <div style={{ fontSize: 13, color: T.inkFaint }}>Loading…</div>}
      {!isLoading && items.length === 0 && (
        <div style={{ fontSize: 13, color: T.inkFaint }}>No activity yet.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(e => (
          <div key={e.id} style={{ background: T.surface, borderRadius: T.r.md, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: T.shadowSm }}>
            <div style={{ width: 34, height: 34, borderRadius: T.r.sm, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
              {e.category ?? '💸'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
              <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{e.payerName} · {e.groupEmoji} {e.groupName}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: T.ink, flexShrink: 0 }}>${e.amount.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <TopBar />
      <div className="home-scroll">
        <HeroRow />
        <div className="home-panels">
          <GroupsPanel />
          <ActivityPanel />
        </div>
      </div>
    </div>
  )
}
