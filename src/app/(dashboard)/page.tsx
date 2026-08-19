'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { BalanceBadge } from '@/components/BalanceBadge'
import { Card, CardChevron } from '@/components/Card'
import { SectionLabel } from '@/components/SectionLabel'
import { HomeMainSkeleton, AttentionSkeleton, RailActivitySkeleton } from '@/components/HomeScreenSkeleton'
import { useNotifications } from '@/queries/useProfile'
import { useGlobalBalances, resolveSeatId } from '@/queries/useGlobalBalances'
import { useGroups } from '@/queries/useGroups'
import { useAllActivity } from '@/queries/useActivity'
import { PersonProfileSheet } from '@/components/home/PersonProfileSheet'
import { BalanceSheet } from '@/components/home/BalanceSheet'
import { BalanceTable, type BalanceRow } from '@/components/dashboard/BalanceTable'
import { FeedCard } from '@/components/feed/FeedCard'
import { toActivityCard } from '@/lib/feedCards'
import { AttentionList } from '@/components/notifications/AttentionList'
import { NotificationsSheet } from '@/components/notifications/NotificationsSheet'
import { useNotificationReviewSheet } from '@/hooks/useNotificationReviewSheet'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { avatarProfile, firstName } from '@/lib/memberDisplay'
import { splitAmount } from '@/lib/money'
import { selectActionable } from '@/lib/notifications'
import type { Profile, NotificationBatch, ActivityItem, PersonPart } from '@/types'

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

// ── Hero ────────────────────────────────────────────────────────────────────

function HeroCard({ gb, people }: { gb: NonNullable<ReturnType<typeof useGlobalBalances>['data']>; people: PersonEntry[] }) {
  const myId = gb.myId
  const total = Math.round((gb.net[myId] ?? 0) * 100) / 100
  const isPositive = total >= 0
  const { whole, cents } = splitAmount(total)
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
      <CardChevron />
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

/** Row count for the rail's activity preview — skeleton mirrors it. */
const RAIL_ACTIVITY_LIMIT = 6

/** Cap on the rail's "Needs attention" preview — overflow goes through
 * "+N more" / "View all" into NotificationsSheet (list → review). */
const ATTN_CAP = 2

function NeedsAttentionRail({ notifications, notificationsLoading, activityItems, activityLoading }: {
  notifications: NotificationBatch[]
  notificationsLoading: boolean
  activityItems: ActivityItem[]
  activityLoading: boolean
}) {
  const router = useRouter()
  const sheet = useNotificationReviewSheet()
  const actionable = selectActionable(notifications)
  const shown = actionable.slice(0, ATTN_CAP)
  const overflow = actionable.length - shown.length
  const recent = activityItems

  return (
    <div className="home-rail">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px' }}>
        <SectionLabel>Needs attention</SectionLabel>
        {actionable.length > 0 && (
          <span style={{ fontFamily: FMONO, fontSize: 10, fontWeight: 700, background: T.sunSoft, color: T.sunInk, padding: '1px 7px', borderRadius: T.r.pill }}>
            {actionable.length}
          </span>
        )}
      </div>
      {notificationsLoading ? (
        <AttentionSkeleton />
      ) : actionable.length === 0 ? (
        <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.55, marginBottom: 20, textAlign: 'center', padding: '20px 16px', borderRadius: T.r.lg, background: T.surface, boxShadow: `inset 0 0 0 0.5px ${T.line}` }}>
          You’re all caught up ✦
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <AttentionList batches={shown} onSelect={sheet.openReview} />
          {overflow > 0 && (
            <button
              type="button"
              onClick={sheet.openList}
              style={{
                width: '100%', marginTop: 8, padding: '9px 4px', border: 0, background: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: 'inherit',
              }}
            >
              <span style={{ fontFamily: FMONO, fontSize: 11, fontWeight: 700, color: T.inkMuted }}>
                {shown.length} of {actionable.length}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.sunInk }}>View all →</span>
            </button>
          )}
        </div>
      )}

      <NotificationsSheet open={sheet.open} onClose={sheet.close} initialReview={sheet.initialReview} />

      {(activityLoading || recent.length > 0) && (
        <>
          <SectionHeader label="Recent activity" action={{ text: 'See all', onClick: () => router.push('/activity') }} />
          {activityLoading ? (
            <RailActivitySkeleton rows={RAIL_ACTIVITY_LIMIT} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map(item => (
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
          )}
        </>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const { data: gb, isLoading } = useGlobalBalances()
  const { data: notifications = [], isLoading: notificationsLoading } = useNotifications()
  const { data: activityItems = [], isLoading: activityLoading } = useAllActivity(RAIL_ACTIVITY_LIMIT)
  const [profilePerson, setProfilePerson] = useState<PersonEntry | null>(null)
  const [balancePerson, setBalancePerson]   = useState<PersonEntry | null>(null)

  const people = gb ? buildPeopleFlow(gb) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <AppHeader title="Home" greeting />

      <div className="home-scroll">
        <div className="home-main">
          {isLoading || !gb ? (
            <HomeMainSkeleton />
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
        <NeedsAttentionRail
          notifications={notifications}
          notificationsLoading={notificationsLoading}
          activityItems={activityItems}
          activityLoading={activityLoading}
        />
      </div>

      <PersonProfileSheet
        open={!!profilePerson}
        onClose={() => setProfilePerson(null)}
        profile={profilePerson?.profile ?? null}
        slot={profilePerson?.slot ?? 0}
        parts={profilePerson?.parts ?? []}
      />

      <BalanceSheet
        open={!!balancePerson}
        onClose={() => setBalancePerson(null)}
        name={balancePerson?.name ?? null}
        profile={balancePerson?.profile}
        slot={balancePerson?.slot ?? 0}
        net={balancePerson?.net ?? 0}
        parts={balancePerson?.parts ?? []}
      />
    </div>
  )
}
