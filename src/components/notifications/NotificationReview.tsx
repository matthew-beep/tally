'use client'

import { InviteReview } from './InviteReview'
import { SettlementReview } from './SettlementReview'
import type { NotificationBatch } from '@/types'

interface Props {
  batch: NotificationBatch
  onResolved: () => void
}

/** Review pane dispatcher — fans out by batch type. */
export function NotificationReview({ batch, onResolved }: Props) {
  if (batch.type === 'group_invite') {
    return <InviteReview batch={batch} onResolved={onResolved} />
  }
  if (batch.type === 'settlement_confirm') {
    return <SettlementReview batch={batch} onResolved={onResolved} />
  }
  return null
}
