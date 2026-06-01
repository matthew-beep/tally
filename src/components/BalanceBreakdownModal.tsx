'use client'

import { Modal } from '@/components/modal/Modal'
import { Avatar } from '@/components/Avatar'
import { T, F, FH, FMONO } from '@/design/tokens'
import type { GlobalBalances } from '@/queries/useGlobalBalances'
import type { Profile } from '@/types'

function hashSlot(id: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

function PersonRow({
  otherId, amount, direction, profileMap,
}: {
  otherId: string
  amount: number
  direction: 'owedToMe' | 'iOwe'
  profileMap: Record<string, Profile>
}) {
  const profile = profileMap[otherId]
  const name = profile ? (profile.display_name ?? profile.name) : 'Unknown'
  const isOwe = direction === 'iOwe'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: `0.5px solid ${T.line}` }}>
      <Avatar profile={profile} slot={hashSlot(otherId)} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
      </div>
      <div style={{
        fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, flexShrink: 0,
        color: isOwe ? T.coralInk : T.mintInk,
      }}>
        {isOwe ? '−' : '+'}${amount.toFixed(2)}
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  gb: GlobalBalances
  direction: 'owedToMe' | 'iOwe'
}

export function BalanceBreakdownModal({ open, onClose, gb, direction }: Props) {
  const { profileMap, grossOwedToMeByPerson, grossIOweByPerson } = gb

  const byPerson = direction === 'owedToMe' ? grossOwedToMeByPerson : grossIOweByPerson
  const rows = Object.entries(byPerson)
    .sort(([, a], [, b]) => b - a)

  const title       = direction === 'owedToMe' ? 'Owed to you' : 'You owe'
  const accentColor = direction === 'owedToMe' ? T.mintInk     : T.coralInk
  const emptyText   = direction === 'owedToMe'
    ? 'Nobody owes you anything right now.'
    : "You don't owe anyone right now."

  return (
    <Modal open={open} onClose={onClose} maxWidth={440} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90dvh' }}>
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: `1px solid ${T.line}`,
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: accentColor }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: T.surfaceAlt, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: T.inkMuted,
            }}
          >✕</button>
        </div>

        {/* body */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px 32px' }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: T.inkMuted }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 13 }}>{emptyText}</div>
            </div>
          ) : (
            rows.map(([otherId, amount]) => (
              <PersonRow
                key={otherId}
                otherId={otherId}
                amount={amount}
                direction={direction}
                profileMap={profileMap}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
