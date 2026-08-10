'use client'

import { T } from '@/design/tokens'
import { Card } from '@/components/Card'
import { useAcceptGroupInvite, useDeclineGroupInvite } from '@/queries/useMembers'
import type { NotificationBatch } from '@/types'

// Invites have no payment behind them, so a batch here is always exactly one
// notification (`batch_id` is NULL, keyed by row id in groupNotifications).
export function GroupInviteCard({ batch }: { batch: NotificationBatch }) {
  const accept = useAcceptGroupInvite()
  const decline = useDeclineGroupInvite()
  const notification = batch.notifications[0]
  const g = notification?.group
  if (!g || !notification.group_id) return null

  return (
    <Card style={{ padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 24, lineHeight: 1 }}>{g.emoji}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>You've been invited to {g.name}</div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>Accept to join and see expenses</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => accept.mutate({ groupId: notification.group_id!, notificationId: notification.id })}
          disabled={accept.isPending || decline.isPending}
          style={{ flex: 1, background: T.mintSoft, color: T.mintInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✓ Accept
        </button>
        <button
          onClick={() => decline.mutate({ groupId: notification.group_id!, notificationId: notification.id })}
          disabled={accept.isPending || decline.isPending}
          style={{ flex: 1, background: T.coralSoft, color: T.coralInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✗ Decline
        </button>
      </div>
    </Card>
  )
}
