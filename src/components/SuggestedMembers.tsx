'use client'

import { T, F, FMONO, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import type { ProfileSnippet } from '@/queries/useProfile'
import type { MemberEntry } from '@/components/MemberCombobox'

function hashSlot(id: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      <path d="M2 5.5l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface SuggestedMembersProps {
  profiles: ProfileSnippet[]
  selected: MemberEntry[]
  onSelect: (profile: ProfileSnippet) => void
  variant?: 'strip' | 'list'
}

function isSelected(profile: ProfileSnippet, selected: MemberEntry[]): boolean {
  return selected.some(m => m.type === 'user' && m.profile.id === profile.id)
}

// ── Strip variant — horizontal scroll row of avatar bubbles ───────────────

function StripItem({ profile, selected, onSelect }: {
  profile: ProfileSnippet
  selected: boolean
  onSelect: () => void
}) {
  const firstName = (profile.display_name ?? profile.name).split(' ')[0]
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        flexShrink: 0, width: 56,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{
          borderRadius: '50%',
          boxShadow: selected ? `0 0 0 2.5px ${T.mint}` : `0 0 0 2px transparent`,
          transition: 'box-shadow 0.15s',
        }}>
          <Avatar profile={profile} slot={hashSlot(profile.id)} size={44} />
        </div>
        {selected && (
          <div style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 18, height: 18, borderRadius: '50%',
            background: T.mint, border: `2px solid ${T.surface}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckIcon />
          </div>
        )}
      </div>
      <div style={{
        fontSize: 10.5, fontWeight: 600, fontFamily: F,
        color: selected ? T.mintInk : T.inkMuted,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 52, textAlign: 'center',
      }}>
        {firstName}
      </div>
    </button>
  )
}

function Strip({ profiles, selected, onSelect }: Omit<SuggestedMembersProps, 'variant'>) {
  return (
    <div style={{
      display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 6px',
      scrollbarWidth: 'none',
    }}>
      {profiles.map(p => (
        <StripItem
          key={p.id}
          profile={p}
          selected={isSelected(p, selected)}
          onSelect={() => onSelect(p)}
        />
      ))}
    </div>
  )
}

// ── List variant — vertical rows with name, handle, checkmark ─────────────

function ListItem({ profile, selected, onSelect, isFirst }: {
  profile: ProfileSnippet
  selected: boolean
  onSelect: () => void
  isFirst: boolean
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', background: selected ? `${T.mint}0D` : 'none',
        border: 'none', borderTop: isFirst ? 'none' : `0.5px solid ${T.line}`,
        cursor: 'pointer', fontFamily: F, textAlign: 'left',
        transition: 'background 0.12s',
      }}
    >
      <Avatar profile={profile} slot={hashSlot(profile.id)} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
          {profile.display_name ?? profile.name}
        </div>
        {profile.handle && (
          <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkFaint, marginTop: 1 }}>
            @{profile.handle}
          </div>
        )}
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: selected ? T.mint : 'transparent',
        border: `2px solid ${selected ? T.mint : T.lineStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s, border-color 0.12s',
      }}>
        {selected && <CheckIcon />}
      </div>
    </button>
  )
}

function List({ profiles, selected, onSelect }: Omit<SuggestedMembersProps, 'variant'>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {profiles.map((p, i) => (
        <ListItem
          key={p.id}
          profile={p}
          selected={isSelected(p, selected)}
          onSelect={() => onSelect(p)}
          isFirst={i === 0}
        />
      ))}
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────

export function SuggestedMembers({ profiles, selected, onSelect, variant = 'strip' }: SuggestedMembersProps) {
  if (!profiles.length) return null
  return variant === 'strip'
    ? <Strip profiles={profiles} selected={selected} onSelect={onSelect} />
    : <List profiles={profiles} selected={selected} onSelect={onSelect} />
}
