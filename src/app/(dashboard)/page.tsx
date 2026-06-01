'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Card } from '@/components/Card'
import { BalanceBadge } from '@/components/BalanceBadge'
import { HeroSkeleton, GroupsSkeleton, ActivitySkeleton } from '@/components/HomeScreenSkeleton'
import { useCurrentProfile } from '@/queries/useProfile'
import { useGroups } from '@/queries/useGroups'
import { useGlobalBalances, useRecentActivity } from '@/queries/useGlobalBalances'
import { BalanceBreakdownModal } from '@/components/BalanceBreakdownModal'
import type { Profile } from '@/types'

type HeroCostTone = 'auto' | 'owedToYou' | 'youOwe'
type HeroCostSize = 'hero' | 'compact'

function heroCost(amount: number, tone: HeroCostTone = 'auto', size: HeroCostSize = 'hero') {
  const signed =
    tone === 'owedToYou' ? Math.abs(amount) :
    tone === 'youOwe'    ? -Math.abs(amount) :
    amount

  const isPositive = signed >= 0
  const whole      = Math.floor(Math.abs(signed)).toLocaleString()
  const cents      = (Math.abs(signed) % 1).toFixed(2).slice(1)
  const sign       = signed >= 0 ? '+' : '−'

  return (
    <div
      className={`home-balance home-balance--${size}`}
      style={{ color: isPositive ? T.mintInk : T.coralInk }}
    >
      <span className="home-balance-sign">{sign}$</span>
      <span className="home-balance-whole">{whole}</span>
      <span className="home-balance-cents">{cents}</span>
    </div>
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
  const { data: gb, isLoading, isFetching } = useGlobalBalances()
  const [owedOpen, setOwedOpen] = useState(false)
  const [iOweOpen, setIOweOpen] = useState(false)
  const myId = gb?.myId

  if (isLoading) return <HeroSkeleton />
  if (!gb || !myId) return null

  const total      = Math.round((gb.net[myId] ?? 0) * 100) / 100
  const isPositive = total >= 0
  const hasBalances = gb.transfers.length > 0

  return (
    <>
      <div className="home-hero" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <div className="home-hero-balance" style={{ background: T.surface, borderRadius: T.r.xl, padding: '22px 22px 20px', boxShadow: T.shadowSm, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: isPositive ? T.mintSoft : T.coralSoft, opacity: 0.6 }} />
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 10 }}>Net balance</div>
          {heroCost(total)}
          <div style={{ fontSize: 12, color: T.inkMuted }}>
            {isPositive ? 'Overall you are owed' : 'Overall you owe'} across all groups
          </div>
        </div>

        <div className="home-hero-split">
          <button
            onClick={() => gb.grossOwedToMe > 0 && setOwedOpen(true)}
            style={{
              background: T.surface, borderRadius: T.r.lg, padding: '20px 20px 16px',
              boxShadow: T.shadowSm, border: 'none', textAlign: 'left',
              cursor: gb.grossOwedToMe > 0 ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column', width: '100%',
            }}
            className="min-w-0"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.mintInk }}>Owed to you</div>
              {gb.grossOwedToMe > 0 && <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: F }}>Details →</span>}
            </div>
            {gb.grossOwedToMe === 0
              ? <div style={{ fontSize: 13, color: T.inkFaint }}>Nothing owed</div>
              : heroCost(gb.grossOwedToMe, 'owedToYou', 'compact')
            }
          </button>
          <button
            onClick={() => gb.grossIOwe > 0 && setIOweOpen(true)}
            style={{
              background: T.surface, borderRadius: T.r.lg, padding: '20px 20px 16px',
              boxShadow: T.shadowSm, border: 'none', textAlign: 'left',
              cursor: gb.grossIOwe > 0 ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column', width: '100%',
            }}
            className="min-w-0"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.coralInk }}>You owe</div>
              {gb.grossIOwe > 0 && <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: F }}>Details →</span>}
            </div>
            {gb.grossIOwe === 0
              ? <div style={{ fontSize: 13, color: T.inkFaint }}>You owe nothing</div>
              : heroCost(gb.grossIOwe, 'youOwe', 'compact')
            }
          </button>
        </div>
      </div>

      <BalanceBreakdownModal open={owedOpen}  onClose={() => setOwedOpen(false)}  gb={gb} direction="owedToMe" />
      <BalanceBreakdownModal open={iOweOpen}  onClose={() => setIOweOpen(false)}  gb={gb} direction="iOwe" />
    </>
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

  const myBal = myId && netPerGroup ? (netPerGroup[group.id]?.[myId] ?? 0) : 0

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
            <Avatar profile={m.profile} slot={i % 4 as 0 | 1 | 2 | 3} size={22} />
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

      {isLoading ? <GroupsSkeleton /> : (
        <>
          {groups.length === 0 && (
            <div style={{ borderRadius: T.r.lg, padding: '32px 20px', border: `2px dashed ${T.lineStrong}`, textAlign: 'center', color: T.inkMuted }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: T.ink }}>No groups yet</div>
              <div style={{ fontSize: 13, color: T.inkFaint, maxWidth: 220, margin: '0 auto' }}>Create a group to start splitting expenses with friends.</div>
            </div>
          )}
          <div className="home-groups-grid">
            {groups.map(g => (
              <GroupCard key={g.id} group={g} myId={gb?.myId} netPerGroup={gb?.netPerGroup} membersPerGroup={gb?.membersPerGroup} />
            ))}
          </div>
        </>
      )}
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

      {isLoading ? <ActivitySkeleton /> : (
        <>
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: T.inkFaint }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>💸</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.inkMuted, marginBottom: 4 }}>No activity yet</div>
              <div style={{ fontSize: 13 }}>Add an expense to get started.</div>
            </div>
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
        </>
      )}
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
