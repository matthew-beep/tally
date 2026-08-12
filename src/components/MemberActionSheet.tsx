'use client'

import { useEffect, useState } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { ModalOrSheet } from '@/components/modal'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
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

interface Display {
  member: GroupMember
  balance: number
  slot: 0 | 1 | 2 | 3
  canRemove: boolean
}

export function MemberActionSheet({ member, balance, slot, canRemove, removing, onRemove, onClose }: Props) {
  // Sticky copy of the last non-null props — ModalOrSheet stays mounted and
  // animates out based on `open`, not on `member` going null, so content
  // must keep rendering from something that doesn't disappear on close.
  const [display, setDisplay] = useState<Display | null>(member ? { member, balance, slot, canRemove } : null)
  useEffect(() => {
    if (member) setDisplay({ member, balance, slot, canRemove })
  }, [member, balance, slot, canRemove])

  if (!display) return null

  const settled   = Math.abs(display.balance) < 0.01
  const removable = display.canRemove && settled

  return (
    <ModalOrSheet open={!!member} onClose={onClose} title={displayName(display.member)} maxWidth={400}>
      <div style={{ padding: '10px 22px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar profile={avatarProfile(display.member)} slot={display.slot} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{displayName(display.member)}</div>
            {display.member.profile?.handle && (
              <div style={{ fontSize: 12, color: T.inkFaint, fontFamily: FMONO, marginTop: 2 }}>@{display.member.profile.handle}</div>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: T.r.pill, background: settled ? T.mintSoft : display.balance > 0 ? T.mintSoft : T.coralSoft, color: settled ? T.mintInk : display.balance > 0 ? T.mintInk : T.coralInk }}>
            {settled ? 'Settled ✓' : formatAmount(display.balance, { sign: true })}
          </span>
        </div>

        {display.canRemove && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.line}`, borderRadius: T.r.card, overflow: 'hidden', boxShadow: T.shadowSm }}>
            {!settled && (
              <div style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, background: T.coralSoft }}>
                <span style={{ fontSize: 12, color: T.coralInk, fontWeight: 600 }}>
                  Settle {formatAmount(display.balance)} first before removing
                </span>
              </div>
            )}
            <button
              onClick={() => removable && !removing && onRemove(display.member.id)}
              disabled={!removable || removing}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'none', border: 0, borderTop: !settled ? `0.5px solid ${T.line}` : 'none', cursor: removable ? 'pointer' : 'default', font: 'inherit', fontFamily: F, textAlign: 'left', opacity: removable ? 1 : 0.4 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: T.coralInk }}>
                {removing ? 'Removing…' : 'Remove from group'}
              </span>
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '15px', borderRadius: T.r.lg, background: T.surfaceAlt, color: T.inkMuted, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: FH, fontSize: 15, fontWeight: 600 }}
        >
          Cancel
        </button>
      </div>
    </ModalOrSheet>
  )
}
