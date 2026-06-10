'use client'

import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/modal/Sheet'
import { Avatar } from '@/components/Avatar'
import { T, FH, FMONO } from '@/design/tokens'
import type { Profile } from '@/types'

interface PersonPart {
  groupId: string
  groupName: string
  groupEmoji: string
  amount: number
}

interface PersonProfileSheetProps {
  open: boolean
  onClose: () => void
  profile: Profile
  slot: 0 | 1 | 2 | 3
  parts: PersonPart[]
}

export function PersonProfileSheet({ open, onClose, profile, slot, parts }: PersonProfileSheetProps) {
  const router = useRouter()
  const name = profile.display_name ?? profile.name
  const firstName = name.split(' ')[0]

  const sharedGroups = parts.map(p => ({
    id: p.groupId,
    name: p.groupName,
    emoji: p.groupEmoji,
  }))

  const totalShared = Math.abs(parts.reduce((sum, p) => sum + p.amount, 0))

  return (
    <Sheet open={open} onClose={onClose} title={`${name}'s profile`}>
      <div style={{ overflowY: 'auto', paddingBottom: 44 }}>
        {/* Avatar + identity */}
        <div style={{
          padding: '20px 22px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          textAlign: 'center',
        }}>
          <Avatar profile={profile} slot={slot} size={80} />
          <div>
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.1, color: T.ink }}>
              {name}
            </div>
            {profile.handle && (
              <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 5, fontFamily: FMONO, letterSpacing: 0.1 }}>
                @{profile.handle}
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ margin: '0 16px 18px', background: T.surface, borderRadius: 18, display: 'flex', overflow: 'hidden', border: `0.5px solid ${T.line}` }}>
          <div style={{ flex: 1, padding: '14px 12px', textAlign: 'center', borderRight: `0.5px solid ${T.line}` }}>
            <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>
              {sharedGroups.length}
            </div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>shared groups</div>
          </div>
          <div style={{ flex: 1, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: FH, fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>
              ${totalShared.toFixed(0)}
            </div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>open balance</div>
          </div>
        </div>

        {/* Shared groups */}
        {sharedGroups.length > 0 && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted, padding: '0 4px 10px' }}>
              Shared groups
            </div>
            <div style={{ background: T.surface, borderRadius: 18, overflow: 'hidden', border: `0.5px solid ${T.line}` }}>
              {sharedGroups.map((g, i) => (
                <div
                  key={g.id}
                  onClick={() => { onClose(); router.push(`/groups/${g.id}`) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                    borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 13, background: T.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {g.emoji}
                  </div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>{g.name}</div>
                  <svg width="5" height="10" viewBox="0 0 6 11" fill="none" style={{ opacity: 0.25, flexShrink: 0 }}>
                    <path d="M1 1l4 4.5L1 10" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View history */}
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 16,
              background: T.surface, color: T.inkMuted,
              border: `1px solid ${T.lineStrong}`,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              textAlign: 'center',
            }}
          >
            View expense history with {firstName}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
