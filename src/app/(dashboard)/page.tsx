'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { BalanceBadge } from '@/components/BalanceBadge'
import { HeroSkeleton } from '@/components/HomeScreenSkeleton'
import { useCurrentProfile } from '@/queries/useProfile'
import { useGlobalBalances } from '@/queries/useGlobalBalances'
import { useGroups } from '@/queries/useGroups'
import { useAllActivity } from '@/queries/useActivity'
import { PersonProfileSheet } from '@/components/home/PersonProfileSheet'
import { BalanceSheet } from '@/components/home/BalanceSheet'
import { avatarProfile, firstName } from '@/lib/memberDisplay'
import type { Profile, ActivityItem } from '@/types'

// ── helpers ────────────────────────────────────────────────────────────────

function hashSlot(id: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

interface PersonPart {
  groupId: string
  groupName: string
  groupEmoji: string
  amount: number
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
      .map(([groupId, amount]) => ({
        groupId,
        groupName: groupMap[groupId]?.name ?? 'Unknown Group',
        groupEmoji: groupMap[groupId]?.emoji ?? '💸',
        amount,
      }))
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
        <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Home</div>
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

  // people is already sorted by |net| descending (buildPeopleFlow)
  const largest = people[0]

  const stats = [
    { v: String(people.length), l: people.length === 1 ? 'person unsettled' : 'people unsettled', c: T.ink },
    largest && {
      v: `${largest.direction === 'owed' ? '+' : '−'}$${Math.abs(largest.net).toFixed(0)}`,
      l: `largest · ${firstName(largest.name)}`,
      c: largest.direction === 'owed' ? T.mintInk : T.coralInk,
    },
  ].filter(Boolean) as { v: string; l: string; c: string }[]

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
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: T.inkMuted }}>
          Net balance
        </div>
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
      {stats.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          borderTop: `0.5px solid ${T.line}`, position: 'relative',
        }}>
          {stats.map((s, i) => (
            <div key={s.l} style={{ padding: '12px 30px 14px', borderLeft: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
              <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: s.c, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PersonCard ─────────────────────────────────────────────────────────────

function PersonCard({
  person,
  isLast,
  onAvatarTap,
  onRowTap,
}: {
  person: PersonEntry
  isLast: boolean
  onAvatarTap: () => void
  onRowTap: () => void
}) {
  const owed = person.direction === 'owed'
  const amtColor = owed ? T.mintInk : T.coralInk
  const name = firstName(person.name)
  const groupHint = person.parts
    .slice(0, 2)
    .map(p => `${p.groupEmoji} ${p.groupName}`)
    .join(' · ')

  const abs = Math.abs(person.net)
  const whole = Math.floor(abs).toLocaleString()

  return (
    <div
      onClick={onRowTap}
      style={{
        padding: '11px 18px',
        borderBottom: isLast ? 'none' : `0.5px solid ${T.line}`,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Avatar — separate tap zone */}
      <div
        onClick={e => { e.stopPropagation(); onAvatarTap() }}
        style={{ flexShrink: 0, cursor: 'pointer' }}
      >
        <Avatar profile={avatarProfile({ name: person.name, profile: person.profile })} slot={person.slot} size={30} />
      </div>

      {/* Name + group hint, inline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{name}</span>
        <span style={{ fontSize: 11.5, color: T.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {groupHint}
        </span>
      </div>

      {/* Owed/owe label + amount */}
      <span style={{ fontSize: 11, color: T.inkFaint, flexShrink: 0 }}>{owed ? 'owes you' : 'you owe'}</span>
      <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums', width: 76, textAlign: 'right', flexShrink: 0, color: amtColor }}>
        {owed ? '+' : '−'}${whole}
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

function OpenBalances({
  people,
  onAvatarTap,
  onRowTap,
}: {
  people: PersonEntry[]
  onAvatarTap: (person: PersonEntry) => void
  onRowTap: (person: PersonEntry) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted }}>
          Open balances
        </span>
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
          <div style={{ background: T.cardBg, border: T.cardBorder, boxShadow: T.cardShadow, borderRadius: 18, overflow: 'hidden' }}>
            {people.map((p, i) => (
              <PersonCard
                key={p.id}
                person={p}
                isLast={i === people.length - 1}
                onAvatarTap={() => onAvatarTap(p)}
                onRowTap={() => onRowTap(p)}
              />
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── RecentGroups ───────────────────────────────────────────────────────────

function SectionHeader({ label, action }: { label: string; action?: { text: string; onClick: () => void } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted }}>
        {label}
      </span>
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

// ── RecentActivity ─────────────────────────────────────────────────────────

const RECENT_ACTIVITY_LIMIT = 6

function RecentActivityRow({ item, isLast }: { item: ActivityItem; isLast: boolean }) {
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: isLast ? 'none' : `0.5px solid ${T.line}`, cursor: 'pointer' } as const

  if (item.type === 'expense') {
    return (
      <div style={rowStyle}>
        <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.category ?? '💸'}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</span>
          <span style={{ fontSize: 11.5, color: T.inkFaint, whiteSpace: 'nowrap' }}>{item.payerName} paid · {item.groupEmoji} {item.groupName}</span>
        </div>
        <span style={{ fontFamily: FH, fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 56, textAlign: 'right', flexShrink: 0, color: T.ink }}>
          ${item.amount.toFixed(0)}
        </span>
      </div>
    )
  }

  const confirmed = item.status === 'confirmed'
  return (
    <div style={rowStyle}>
      <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{confirmed ? '✓' : '⏳'}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: confirmed ? T.mintInk : T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.fromName} paid {item.toName}</span>
        <span style={{ fontSize: 11.5, color: T.inkFaint, whiteSpace: 'nowrap' }}>{item.groupEmoji} {item.groupName}</span>
      </div>
      <span style={{ fontFamily: FH, fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 56, textAlign: 'right', flexShrink: 0, color: confirmed ? T.mintInk : T.ink }}>
        ${item.amount.toFixed(0)}
      </span>
    </div>
  )
}

function RecentActivity() {
  const router = useRouter()
  const { data: groups = [] } = useAllActivity()
  const items = groups
    .flatMap(g => g.items)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT)

  if (items.length === 0) return null

  return (
    <div>
      <SectionHeader label="Recent activity" action={{ text: 'See all', onClick: () => router.push('/activity') }} />
      <div style={{ background: T.cardBg, border: T.cardBorder, boxShadow: T.cardShadow, borderRadius: 18, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <RecentActivityRow key={item.id} item={item} isLast={i === items.length - 1} />
        ))}
      </div>
    </div>
  )
}

// ── NeedsAttentionRail ─────────────────────────────────────────────────────
// Structure only — nothing feeds this yet (settlement confirmations + group
// invites land here once that data is wired up).

function NeedsAttentionRail() {
  return (
    <div className="home-rail">
      <SectionHeader label="Needs attention" />
      <div style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.55 }}>
        Nothing waiting on you. Payments to confirm and group invites will land here.
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: gb, isLoading } = useGlobalBalances()
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
            <div className="home-content" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
              <HeroCard gb={gb} people={people} />
              <OpenBalances
                people={people}
                onAvatarTap={p => { if (p.userType === 'user') setProfilePerson(p) }}
                onRowTap={p => setBalancePerson(p)}
              />
              <div className="home-desktop-only">
                <RecentGroups gb={gb} />
                <RecentActivity />
              </div>
            </div>
          )}
        </div>
        <NeedsAttentionRail />
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
