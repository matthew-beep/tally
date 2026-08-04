'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { BalanceBadge } from '@/components/BalanceBadge'
import { Card } from '@/components/Card'
import { SectionLabel } from '@/components/SectionLabel'
import { HeroSkeleton } from '@/components/HomeScreenSkeleton'
import { useCurrentProfile, useNotifications } from '@/queries/useProfile'
import { useGlobalBalances, resolveSeatId } from '@/queries/useGlobalBalances'
import { useGroups } from '@/queries/useGroups'
import { useAllActivity } from '@/queries/useActivity'
import { PersonProfileSheet } from '@/components/home/PersonProfileSheet'
import { BalanceSheet } from '@/components/home/BalanceSheet'
import { BalanceTable, type BalanceRow } from '@/components/dashboard/BalanceTable'
import { ActivityRow } from '@/components/ActivityRow'
import { GroupInviteCard } from '@/components/notifications/GroupInviteCard'
import { SettlementConfirmCard } from '@/components/notifications/SettlementConfirmCard'
import { avatarProfile, firstName } from '@/lib/memberDisplay'
import type { Profile, Notification, ActivityItem, PersonPart } from '@/types'

// ── helpers ────────────────────────────────────────────────────────────────

function hashSlot(id: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

interface PersonEntry {
  id: string
  name: string
  profile?: Profile
  slot: 0 | 1 | 2 | 3
  net: number
  direction: 'owed' | 'owe'
  parts: PersonPart[]
  userType: 'user' | 'guest'
}

function buildPeopleFlow(gb: NonNullable<ReturnType<typeof useGlobalBalances>['data']>): PersonEntry[] {
  const { pairwisePerGroup, profileMap, membersPerGroup, groupMap, myId } = gb
  const people: PersonEntry[] = []

  // Build a name lookup for guests keyed by group_member_id
  const guestNameMap: Record<string, string> = {}
  for (const members of Object.values(membersPerGroup)) {
    for (const m of members) {
      if (!m.user_id) guestNameMap[m.id] = m.name
    }
  }

  for (const [personId, groups] of Object.entries(pairwisePerGroup)) {
    if (personId === myId) continue
    const net = Math.round(Object.values(groups).reduce((s, v) => s + v, 0) * 100) / 100
    if (Math.abs(net) < 0.01) continue

    const profile = profileMap[personId]
    const guestName = guestNameMap[personId]
    if (!profile && !guestName) continue

    const parts = Object.entries(groups)
      .filter(([, amt]) => Math.abs(amt) >= 0.01)
      .flatMap(([groupId, amount]) => {
        // Every entry here came from a seat in this group, and my own seat was
        // already proven to exist before the pairwise math ran, so both of
        // these always resolve — the guard only keeps the ids non-optional for
        // the settlement write path downstream.
        const groupMemberId = resolveSeatId(gb, groupId, personId)
        const mySeatId      = resolveSeatId(gb, groupId, myId)
        if (!groupMemberId || !mySeatId) return []
        return [{
          groupId,
          groupName: groupMap[groupId]?.name ?? 'Unknown Group',
          groupEmoji: groupMap[groupId]?.emoji ?? '💸',
          amount,
          groupMemberId,
          mySeatId,
        }]
      })
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

    people.push({
      id: personId,
      name: profile ? (profile.display_name ?? profile.name) : guestName!,
      profile,
      slot: hashSlot(personId),
      net,
      direction: net > 0 ? 'owed' : 'owe',
      parts,
      userType: profile ? 'user' : 'guest',
    })
  }

  return people.sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
}

// ── TopBar ─────────────────────────────────────────────────────────────────

function TopBar() {
  const router = useRouter()
  const { data: profile } = useCurrentProfile()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="home-topbar" style={{ borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 10 }}>
      <div>
        <SectionLabel>Home</SectionLabel>
        <div className="home-topbar-greeting" style={{ fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, color: T.ink, marginTop: 1 }}>
          {greeting}{profile ? ` ${firstName(profile.display_name ?? profile.name)}` : ''}
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

// ── Hero ────────────────────────────────────────────────────────────────────

function HeroCard({ gb, people }: { gb: NonNullable<ReturnType<typeof useGlobalBalances>['data']>; people: PersonEntry[] }) {
  const myId = gb.myId
  const total = Math.round((gb.net[myId] ?? 0) * 100) / 100
  const isPositive = total >= 0
  const whole = Math.floor(Math.abs(total)).toLocaleString()
  const cents = (Math.abs(total) % 1).toFixed(2).slice(1)
  const sign = total >= 0 ? '+' : '−'
  const mainColor = isPositive ? T.mintInk : T.coralInk
  const softBg = isPositive ? T.mintSoft : T.coralSoft

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: T.cardBg, borderRadius: 22,
      border: T.cardBorder, boxShadow: T.cardShadow,
    }}>
      <div style={{
        position: 'absolute', top: -80, right: -60,
        width: 260, height: 260, borderRadius: '50%',
        background: softBg, opacity: 0.55, filter: 'blur(4px)',
        pointerEvents: 'none',
      }} />
      <div style={{ padding: '26px 30px 22px', position: 'relative' }}>
        <SectionLabel size="sm">Net balance</SectionLabel>
        <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 1, lineHeight: 1 }}>
          <span style={{ fontFamily: FH, fontSize: 26, fontWeight: 500, color: mainColor, opacity: 0.7 }}>{sign}$</span>
          <span style={{ fontFamily: FH, fontSize: 52, fontWeight: 700, letterSpacing: -2, color: mainColor, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
          <span style={{ fontFamily: FMONO, fontSize: 20, fontWeight: 600, color: mainColor, opacity: 0.7 }}>{cents}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { dot: T.mint,  color: T.mintInk,  sign: '+', val: gb.grossOwedToMe, label: 'owed to you' },
            { dot: T.coral, color: T.coralInk, sign: '−', val: gb.grossIOwe,     label: 'you owe' },
          ].map(({ dot, color, sign: s, val, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
              <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 600, letterSpacing: -0.3, color, fontVariantNumeric: 'tabular-nums' }}>
                {s}${val.toFixed(0)}
              </span>
              <span style={{ fontSize: 11, color: T.inkMuted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── All square empty state ─────────────────────────────────────────────────

function AllSquare() {
  return (
    <div style={{
      padding: '32px 20px', textAlign: 'center',
      background: T.cardBg, borderRadius: 20,
      border: T.cardBorder, boxShadow: T.cardShadow,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 16, background: T.mintSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4 4L19 7" stroke={T.mintInk} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>All square</div>
      <div style={{ fontSize: 12.5, color: T.inkMuted, lineHeight: 1.5 }}>No open balances right now.</div>
    </div>
  )
}

// ── Open Balances section ─────────────────────────────────────────────────

function PersonRow({ person, onAvatarTap, onRowTap }: {
  person: PersonEntry
  onAvatarTap: () => void
  onRowTap: () => void
}) {
  const groupHint = person.parts
    .slice(0, 2)
    .map(p => `${p.groupEmoji} ${p.groupName}`)
    .join(' · ')

  return (
    <Card
      hoverable
      onClick={onRowTap}
      style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <div onClick={e => { e.stopPropagation(); onAvatarTap() }} style={{ flexShrink: 0, cursor: 'pointer' }}>
        <Avatar profile={avatarProfile({ name: person.name, profile: person.profile })} slot={person.slot} size={40} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {firstName(person.name)}
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {groupHint}
        </div>
      </div>
      <BalanceBadge amount={person.net} />
    </Card>
  )
}

function personToRow(person: PersonEntry, onAvatarTap: (p: PersonEntry) => void, onRowTap: (p: PersonEntry) => void): BalanceRow {
  return {
    id: person.id,
    avatar: avatarProfile({ name: person.name, profile: person.profile }),
    slot: person.slot,
    label: firstName(person.name),
    amount: person.net,
    breakdown: person.parts.slice(0, 3).map(part => ({
      key: part.groupId,
      label: `${part.groupEmoji} ${part.groupName}`,
      amount: part.amount,
    })),
    onAvatarClick: () => onAvatarTap(person),
    onClick: () => onRowTap(person),
  }
}

function OpenBalances({
  people,
  onAvatarTap,
  onRowTap,
}: {
  people: PersonEntry[]
  onAvatarTap: (person: PersonEntry) => void
  onRowTap: (person: PersonEntry) => void
}) {
  const owed = people.filter(p => p.direction === 'owed')
  const owe = people.filter(p => p.direction === 'owe')
  const owedSum = owed.reduce((s, p) => s + p.net, 0)
  const oweSum = owe.reduce((s, p) => s + Math.abs(p.net), 0)

  return (
    <div className="home-people">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px', flexShrink: 0 }}>
        <SectionLabel>Open balances</SectionLabel>
        {people.length > 0 && (
          <span style={{
            fontFamily: FMONO, fontSize: 10, fontWeight: 700,
            background: T.surfaceAlt, color: T.inkMuted,
            padding: '1px 6px', borderRadius: 999,
          }}>{people.length}</span>
        )}
      </div>
      {people.length === 0
        ? <AllSquare />
        : (
          <>
            {/* Mobile — flat list of person cards, same row style as the groups list */}
            <div className="home-people-list-mobile">
              {people.map(p => (
                <PersonRow key={p.id} person={p} onAvatarTap={() => onAvatarTap(p)} onRowTap={() => onRowTap(p)} />
              ))}
            </div>

            {/* Desktop — two-column ledger with independent scroll per column */}
            <div className="home-people-card home-people-table-desktop" style={{ background: T.cardBg, border: T.cardBorder, boxShadow: T.cardShadow, borderRadius: 20, padding: '18px 22px' }}>
              <BalanceTable
                left={{
                  title: 'Owes you',
                  accent: T.mintInk,
                  sum: owedSum,
                  sign: '+',
                  rows: owed.map(p => personToRow(p, onAvatarTap, onRowTap)),
                }}
                right={{
                  title: 'You owe',
                  accent: T.coralInk,
                  sum: oweSum,
                  sign: '−',
                  rows: owe.map(p => personToRow(p, onAvatarTap, onRowTap)),
                }}
              />
            </div>
          </>
        )
      }
    </div>
  )
}

// ── RecentGroups ───────────────────────────────────────────────────────────

function SectionHeader({ label, action }: { label: string; action?: { text: string; onClick: () => void } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
      <SectionLabel>{label}</SectionLabel>
      {action && (
        <button
          onClick={action.onClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, fontSize: 12, fontWeight: 700, color: T.sunInk }}
        >
          {action.text}
        </button>
      )}
    </div>
  )
}

const RECENT_GROUPS_LIMIT = 6

function RecentGroups({ gb }: { gb: NonNullable<ReturnType<typeof useGlobalBalances>['data']> }) {
  const router = useRouter()
  const { data: groups = [] } = useGroups()
  const recent = groups.slice(0, RECENT_GROUPS_LIMIT)

  if (recent.length === 0) return null

  return (
    <div>
      <SectionHeader label="Recent groups" action={{ text: 'See all', onClick: () => router.push('/groups') }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {recent.map(g => {
          const net = gb.netPerGroup[g.id]?.[gb.myId] ?? 0
          return (
            <div
              key={g.id}
              onClick={() => router.push(`/groups/${g.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px 8px 11px', borderRadius: T.r.pill,
                background: T.cardBg, border: T.cardBorder, boxShadow: T.cardShadow,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15 }}>{g.emoji}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{g.name}</span>
              <BalanceBadge amount={net} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── NeedsAttentionRail ─────────────────────────────────────────────────────
// Actionable notifications only — group invites and settlement confirmations.
// Info-only types (accepted/declined/confirmed/denied) stay on /me. Recent
// activity (across all groups) rides along in the same right rail.

const ACTIONABLE_TYPES: Notification['type'][] = ['group_invite', 'settlement_confirm']

function NeedsAttentionRail({ notifications, activityItems, activityLoading }: {
  notifications: Notification[]
  activityItems: ActivityItem[]
  activityLoading: boolean
}) {
  const router = useRouter()
  const actionable = notifications.filter(n => ACTIONABLE_TYPES.includes(n.type))
  const recent = activityItems

  return (
    <div className="home-rail">
      <SectionHeader label="Needs attention" />
      {actionable.length === 0 ? (
        <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.55, marginBottom: 20 }}>
          Nothing waiting on you. Payments to confirm and group invites will land here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {actionable.map(n =>
            n.type === 'group_invite'
              ? <GroupInviteCard key={n.id} notification={n} />
              : <SettlementConfirmCard key={n.id} notification={n} />
          )}
        </div>
      )}

      {(activityLoading || recent.length > 0) && (
        <>
          <SectionHeader label="Recent activity" action={{ text: 'See all', onClick: () => router.push('/activity') }} />
          {activityLoading ? (
            <div style={{ fontSize: 12, color: T.inkFaint }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map(item => (
                <div key={item.id} onClick={() => router.push(`/groups/${item.groupId}`)} style={{ cursor: 'pointer' }}>
                  <ActivityRow item={item} showGroup />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: gb, isLoading } = useGlobalBalances()
  const { data: notifications = [] } = useNotifications()
  const { data: activityItems = [], isLoading: activityLoading } = useAllActivity(6)
  const [profilePerson, setProfilePerson] = useState<PersonEntry | null>(null)
  const [balancePerson, setBalancePerson]   = useState<PersonEntry | null>(null)

  const people = gb ? buildPeopleFlow(gb) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <TopBar />

      <div className="home-scroll">
        <div className="home-main">
          {isLoading || !gb ? (
            <HeroSkeleton />
          ) : (
            <div className="home-content" style={{ display: 'flex', flexDirection: 'column', gap: 26, flex: 1, minHeight: 0 }}>
              <div style={{ flexShrink: 0 }}>
                <HeroCard gb={gb} people={people} />
              </div>
              <OpenBalances
                people={people}
                onAvatarTap={p => { if (p.userType === 'user') setProfilePerson(p) }}
                onRowTap={p => setBalancePerson(p)}
              />
            </div>
          )}
        </div>
        <NeedsAttentionRail notifications={notifications} activityItems={activityItems} activityLoading={activityLoading} />
      </div>

      {profilePerson?.profile && (
        <PersonProfileSheet
          open={!!profilePerson}
          onClose={() => setProfilePerson(null)}
          profile={profilePerson.profile}
          slot={profilePerson.slot}
          parts={profilePerson.parts}
        />
      )}

      {balancePerson && (
        <BalanceSheet
          open={!!balancePerson}
          onClose={() => setBalancePerson(null)}
          name={balancePerson.name}
          profile={balancePerson.profile}
          slot={balancePerson.slot}
          net={balancePerson.net}
          parts={balancePerson.parts}
        />
      )}
    </div>
  )
}
