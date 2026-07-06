'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { HeroSkeleton } from '@/components/HomeScreenSkeleton'
import { useCurrentProfile } from '@/queries/useProfile'
import { useGlobalBalances } from '@/queries/useGlobalBalances'
import { PersonProfileSheet } from '@/components/home/PersonProfileSheet'
import { BalanceSheet } from '@/components/home/BalanceSheet'
import { avatarProfile } from '@/lib/memberDisplay'
import type { Profile } from '@/types'

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

// ── Hero ────────────────────────────────────────────────────────────────────

function HeroCard({ gb }: { gb: NonNullable<ReturnType<typeof useGlobalBalances>['data']> }) {
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
      padding: '20px 22px',
    }}>
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 160, height: 160, borderRadius: '50%',
        background: softBg, opacity: 0.55, filter: 'blur(4px)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>
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
    </div>
  )
}

// ── PersonCard ─────────────────────────────────────────────────────────────

function PersonCard({
  person,
  onAvatarTap,
  onRowTap,
}: {
  person: PersonEntry
  onAvatarTap: () => void
  onRowTap: () => void
}) {
  const owed = person.direction === 'owed'
  const amtColor = owed ? T.mintInk : T.coralInk
  const firstName = person.name.split(' ')[0]
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
        background: T.cardBg,
        border: T.cardBorder,
        boxShadow: T.cardShadow,
        borderRadius: 18, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 13,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Avatar — separate tap zone */}
      <div
        onClick={e => { e.stopPropagation(); onAvatarTap() }}
        style={{ flexShrink: 0, cursor: 'pointer' }}
      >
        <Avatar profile={avatarProfile({ name: person.name, profile: person.profile })} slot={person.slot} size={44} />
      </div>

      {/* Name + group hint */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.25, lineHeight: 1.2, color: T.ink }}>
          {firstName}
        </div>
        <div style={{ fontSize: 11, marginTop: 2.5, color: T.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {groupHint}
        </div>
      </div>

      {/* Amount + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1, color: amtColor, fontVariantNumeric: 'tabular-nums' }}>
          {owed ? '+' : '−'}${whole}
        </div>
        <svg width="5" height="10" viewBox="0 0 6 11" fill="none" style={{ opacity: 0.22, flexShrink: 0 }}>
          <path d="M1 1l4 4.5L1 10" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {people.map(p => (
              <PersonCard
                key={p.id}
                person={p}
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
        {isLoading || !gb ? (
          <HeroSkeleton />
        ) : (
          <>
            <HeroCard gb={gb} />
            <OpenBalances
              people={people}
              onAvatarTap={p => { if (p.userType === 'user') setProfilePerson(p) }}
              onRowTap={p => setBalancePerson(p)}
            />
          </>
        )}
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

      {balancePerson && balancePerson.profile && (
        <BalanceSheet
          open={!!balancePerson}
          onClose={() => setBalancePerson(null)}
          profile={balancePerson.profile}
          slot={balancePerson.slot}
          net={balancePerson.net}
          parts={balancePerson.parts}
        />
      )}
    </div>
  )
}
