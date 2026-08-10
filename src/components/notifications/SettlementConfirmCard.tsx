'use client'

import { T } from '@/design/tokens'
import { Card } from '@/components/Card'
import { formatAmount } from '@/lib/money'
import { useConfirmSettlement, useDenySettlement } from '@/queries/useSettlements'
import { batchGroupIds, batchNotificationIds, batchSettlementIds } from '@/lib/notifications'
import type { NotificationBatch } from '@/types'

// Phase A shape only — takes a batch and acts on all of it, but still renders
// the single-settlement layout. The batch card proper (net headline, one line
// per group, offsetting rows marked) lands with the notification center,
// TODO item 12 phase B. Multi-row batches are unreachable until item 5 step 3
// wires the dashboard CTAs, so this renders identically today.
export function SettlementConfirmCard({ batch }: { batch: NotificationBatch }) {
  const confirm = useConfirmSettlement()
  const deny = useDenySettlement()
  const s = batch.settlements[0]
  if (!s) return null

  const fromP    = s.from_member?.profile
  const fromName = fromP ? (fromP.display_name ?? fromP.name) : s.from_member?.name ?? '…'

  return (
    <Card style={{ padding: '14px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {fromName} says they paid you {formatAmount(batch.amount)}
      </div>
      {s.note && <div style={{ fontSize: 12, color: T.inkMuted, marginBottom: 12 }}>{s.note}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => confirm.mutate({
            settlementIds:   batchSettlementIds(batch),
            groupIds:        batchGroupIds(batch),
            notificationIds: batchNotificationIds(batch),
          })}
          disabled={confirm.isPending}
          style={{ flex: 1, background: T.mintSoft, color: T.mintInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✓ Confirm
        </button>
        <button
          onClick={() => deny.mutate({
            settlementIds: batchSettlementIds(batch),
            groupIds:      batchGroupIds(batch),
          })}
          disabled={deny.isPending}
          style={{ flex: 1, background: T.coralSoft, color: T.coralInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✗ Deny
        </button>
      </div>
    </Card>
  )
}
