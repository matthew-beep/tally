'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F, FH, FMONO } from '@/design/tokens'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import type { GroupMember } from '@/types'

interface Props {
  member: GroupMember | null
  balance: number
  slot: 0 | 1 | 2 | 3
  canRemove: boolean
  removing: boolean
  onRemove: (memberId: string) => void
  onClose: () => void
}

export function MemberActionSheet({ member, balance, slot, canRemove, removing, onRemove, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useBodyScrollLock(!!member)

  useEffect(() => {
    if (!member) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [member, onClose])

  if (!member || !mounted) return null

  const settled = Math.abs(balance) < 0.01
  const removable = canRemove && settled

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'tally-fade 0.18s ease' }}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: `${T.r.sheet}px ${T.r.sheet}px 0 0`, background: T.bg, boxShadow: T.shadowModal, animation: 'tally-slideup 0.26s cubic-bezier(.34,1.0,.5,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 38, height: 5, borderRadius: 3, background: T.lineStrong }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px 14px' }}>
          <Avatar profile={avatarProfile(member)} slot={slot} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{displayName(member)}</div>
            {member.profile?.handle && (
              <div style={{ fontSize: 12, color: T.inkFaint, fontFamily: FMONO, marginTop: 2 }}>@{member.profile.handle}</div>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: T.r.pill, background: settled ? T.mintSoft : balance > 0 ? T.mintSoft : T.coralSoft, color: settled ? T.mintInk : balance > 0 ? T.mintInk : T.coralInk }}>
            {settled ? 'Settled ✓' : `${balance > 0 ? '+' : '−'}$${Math.abs(balance).toFixed(2)}`}
          </span>
        </div>

        {canRemove && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.line}`, borderRadius: T.r.card, margin: '0 16px', overflow: 'hidden', boxShadow: T.shadowSm }}>
            {!settled && (
              <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, background: T.coralSoft }}>
                <span style={{ fontSize: 12, color: T.coralInk, fontWeight: 600 }}>
                  Settle ${Math.abs(balance).toFixed(2)} first before removing
                </span>
              </div>
            )}
            <button
              onClick={() => removable && !removing && onRemove(member.id)}
              disabled={!removable || removing}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'none', border: 0, borderTop: !settled ? `0.5px solid ${T.line}` : 'none', cursor: removable ? 'pointer' : 'default', font: 'inherit', fontFamily: F, textAlign: 'left', opacity: removable ? 1 : 0.4 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: T.coralInk }}>
                {removing ? 'Removing…' : 'Remove from group'}
              </span>
            </button>
          </div>
        )}

        <div style={{ padding: '14px 16px 34px' }}>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '15px', borderRadius: T.r.lg, background: T.surfaceAlt, color: T.inkMuted, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: FH, fontSize: 15, fontWeight: 600 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
