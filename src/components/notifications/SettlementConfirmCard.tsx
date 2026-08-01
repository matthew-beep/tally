'use client'

import { T } from '@/design/tokens'
import { Card } from '@/components/Card'
import { formatAmount } from '@/lib/money'
import { useConfirmSettlement, useDenySettlement } from '@/queries/useSettlements'
import type { Notification } from '@/types'

export function SettlementConfirmCard({ notification }: { notification: Notification }) {
  const confirm = useConfirmSettlement()
  const deny = useDenySettlement()
  const s = notification.settlement
  if (!s) return null

  const fromP    = s.from_member?.profile
  const fromName = fromP ? (fromP.display_name ?? fromP.name) : s.from_member?.name ?? '…'

  return (
    <Card style={{ padding: '14px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {fromName} says they paid you {formatAmount(Number(s.amount))}
      </div>
      {s.note && <div style={{ fontSize: 12, color: T.inkMuted, marginBottom: 12 }}>{s.note}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => confirm.mutate({ id: s.id, groupId: s.group_id })}
          disabled={confirm.isPending}
          style={{ flex: 1, background: T.mintSoft, color: T.mintInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✓ Confirm
        </button>
        <button
          onClick={() => deny.mutate({ id: s.id, groupId: s.group_id })}
          disabled={deny.isPending}
          style={{ flex: 1, background: T.coralSoft, color: T.coralInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✗ Deny
        </button>
      </div>
    </Card>
  )
}
