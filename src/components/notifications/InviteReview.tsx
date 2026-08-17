'use client'

import { T, FH } from '@/design/tokens'
import { useAcceptGroupInvite, useDeclineGroupInvite } from '@/queries/useMembers'
import { NotificationActionFooter } from './NotificationActionFooter'
import type { NotificationBatch } from '@/types'

interface Props {
  batch: NotificationBatch
  onResolved: () => void
}

// No inviter name or member-preview stack — neither is available on the
// notification/group join today (schema has no `invited_by` on notifications).
export function InviteReview({ batch, onResolved }: Props) {
  const accept = useAcceptGroupInvite()
  const decline = useDeclineGroupInvite()
  const notification = batch.notifications[0]
  const g = notification?.group
  if (!g || !notification.group_id) return null

  const busy = accept.isPending || decline.isPending
  const groupId = notification.group_id
  const notificationId = notification.id

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 26px 0', textAlign: 'center' }}>
        <div style={{
          width: 60, height: 60, borderRadius: 18, background: T.sunSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, margin: '2px auto 0',
        }}>
          {g.emoji}
        </div>
        <div style={{ fontSize: 15, color: T.inkMuted, marginTop: 14 }}>
          You&rsquo;ve been invited to
        </div>
        <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 700, letterSpacing: -0.6, marginTop: 4, color: T.ink }}>
          {g.name}
        </div>
      </div>

      <NotificationActionFooter
        secondary={{
          label: 'Decline',
          disabled: busy,
          onClick: () => decline.mutate(
            { groupId, notificationId },
            { onSuccess: onResolved },
          ),
        }}
        primary={{
          label: 'Join group',
          disabled: busy,
          background: T.sun,
          color: T.sunOn,
          onClick: () => accept.mutate(
            { groupId, notificationId },
            { onSuccess: onResolved },
          ),
        }}
        hint="Joining adds this group to your dashboard."
      />
    </>
  )
}
