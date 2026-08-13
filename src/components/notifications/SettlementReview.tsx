'use client'

import { T, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, displayName, firstName } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import { useConfirmSettlement, useDenySettlement } from '@/queries/useSettlements'
import { batchGroupIds, batchNotificationIds, batchSettlementIds } from '@/lib/notifications'
import { NotificationActionFooter } from './NotificationActionFooter'
import type { NotificationBatch } from '@/types'

interface Props {
  batch: NotificationBatch
  onResolved: () => void
}

export function SettlementReview({ batch, onResolved }: Props) {
  const confirm = useConfirmSettlement()
  const deny = useDenySettlement()
  const s = batch.settlements[0]
  if (!s) return null

  const fromMember = s.from_member
  const fromName = fromMember ? displayName(fromMember) : '…'
  const fromFirst = fromMember ? firstName(fromName) : '…'
  const multi = batch.settlements.length > 1
  const busy = deny.isPending || confirm.isPending
  // Settlement notifications carry no group_id of their own — the joined
  // settlement row is the only reliable source of group name/emoji here.
  const singleGroup = batch.notifications[0]?.settlement?.group

  const groupRows = batch.notifications.map(n => ({
    key: n.id,
    emoji: n.settlement?.group?.emoji ?? '💸',
    name: n.settlement?.group?.name ?? 'Group',
    note: n.settlement?.note ?? null,
    amount: Number(n.settlement?.amount ?? n.amount ?? 0),
  }))

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 26px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Avatar profile={fromMember ? avatarProfile(fromMember) : undefined} size={60} />
        </div>
        <div style={{ fontSize: 15, color: T.inkMuted, marginTop: 14 }}>
          <b style={{ color: T.ink }}>{fromName}</b> says they paid you
        </div>
        <div style={{ fontFamily: FH, fontSize: 52, fontWeight: 700, letterSpacing: -2, color: T.mintInk, marginTop: 6 }}>
          {formatAmount(batch.amount)}
        </div>
        <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 6 }}>
          {multi
            ? `Across ${batch.settlements.length} groups`
            : singleGroup
              ? `${singleGroup.emoji} ${singleGroup.name}`
              : 'One payment'}
        </div>

        <div style={{ margin: '20px 0 0', textAlign: 'left' }}>
          {multi && (
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: T.inkMuted, padding: '0 2px 8px' }}>
              Groups settling
            </div>
          )}
          <div style={{ background: T.surface, borderRadius: 14, overflow: 'hidden', boxShadow: `inset 0 0 0 0.5px ${T.line}` }}>
            {groupRows.map((g, i) => (
              <div
                key={g.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
                  borderTop: i ? `0.5px solid ${T.line}` : 0,
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 11, background: T.surfaceAlt,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0,
                }}>
                  {g.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{g.name}</div>
                  {g.note && (
                    <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 1, fontStyle: 'italic' }}>
                      “{g.note}”
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: T.mintInk }}>
                  {formatAmount(g.amount)}
                </div>
              </div>
            ))}
            {multi && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderTop: `0.5px solid ${T.line}`, background: T.mintSoft,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.mintInk }}>Total</span>
                <span style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, color: T.mintInk }}>
                  {formatAmount(batch.amount)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <NotificationActionFooter
        secondary={{
          label: 'Not yet',
          disabled: busy,
          onClick: () => deny.mutate(
            { settlementIds: batchSettlementIds(batch), groupIds: batchGroupIds(batch) },
            { onSuccess: onResolved },
          ),
        }}
        primary={{
          label: multi ? 'Confirm all' : 'Confirm payment',
          disabled: busy,
          background: T.mint,
          color: '#fff',
          onClick: () => confirm.mutate(
            {
              settlementIds: batchSettlementIds(batch),
              groupIds: batchGroupIds(batch),
              notificationIds: batchNotificationIds(batch),
            },
            { onSuccess: onResolved },
          ),
        }}
        hint={multi
          ? `Confirms all ${batch.settlements.length} payments from ${fromFirst} at once.`
          : `${fromFirst} will be notified.`}
      />
    </>
  )
}
