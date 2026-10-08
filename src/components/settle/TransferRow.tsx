'use client'

import { T, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { formatAmount } from '@/lib/money'
import type { Transfer } from '@/types'

interface Props {
  transfer: Transfer
  /** Omit to render a non-interactive row (read-only balance views). */
  onTap?: () => void
}

export function TransferRow({ transfer, onTap }: Props) {
  const owed = transfer.direction === 'owed'
  const amountColor = owed ? T.mintInk : T.coralInk

  const content = (
    <>
      <Avatar profile={transfer.avatar} slot={transfer.slot} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{transfer.name}</div>
        <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 1 }}>{owed ? 'owes you' : 'you owe'}</div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 14.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: amountColor }}>
        {formatAmount(transfer.amount)}
      </div>
    </>
  )

  if (!onTap) {
    return (
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 4px' }}>
        {content}
      </div>
    )
  }

  return (
    // Outlined card + chevron so the row reads as tappable (it drills into the settle form).
    <button
      onClick={onTap}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', marginBottom: 6, background: T.surface, border: `0.5px solid ${T.lineStrong}`, borderRadius: T.r.md, boxShadow: T.shadowSm, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
    >
      {content}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
        <path d="M6 3.5l4.5 4.5L6 12.5" stroke={T.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
