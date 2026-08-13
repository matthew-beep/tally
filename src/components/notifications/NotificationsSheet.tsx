'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { ModalOrSheet } from '@/components/modal'
import { AttentionList } from './AttentionList'
import { NotificationReview } from './NotificationReview'
import { useNotifications } from '@/queries/useProfile'
import { selectActionable } from '@/lib/notifications'
import { T, FH } from '@/design/tokens'
import type { NotificationBatch } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, open straight on this batch's review (rail row). */
  initialReview?: NotificationBatch | null
}

// List ↔ review center. View all lands on the list; a rail row lands on review.
// Confirm/Deny/Join/Decline live only in the review pane.
export function NotificationsSheet({ open, onClose, initialReview = null }: Props) {
  const { data: notifications = [] } = useNotifications()
  const actionable = selectActionable(notifications)
  const [review, setReview] = useState<NotificationBatch | null>(null)

  useEffect(() => {
    if (open) setReview(initialReview ?? null)
  }, [open, initialReview])

  function handleClose() {
    setReview(null)
    onClose()
  }

  function handleResolved(resolvedKey: string) {
    const idx = actionable.findIndex(b => b.key === resolvedKey)
    const rest = actionable.filter(b => b.key !== resolvedKey)
    setReview(rest[idx] ?? null)
  }

  const inReview = !!review
  const isInvite = review?.type === 'group_invite'
  const title = inReview
    ? (isInvite ? 'Group invite' : 'Payment received')
    : 'Notifications'
  const subtitle = inReview
    ? null
    : actionable.length > 0
      ? `${actionable.length} ${actionable.length === 1 ? 'thing needs' : 'things need'} your attention`
      : 'You’re all caught up'

  return (
    <ModalOrSheet open={open} onClose={handleClose} title={title} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '84vh', minHeight: inReview ? 420 : undefined }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '22px 24px 16px', flexShrink: 0 }}>
          {inReview && (
            <button
              type="button"
              onClick={() => setReview(null)}
              aria-label="Back to list"
              style={{
                width: 32, height: 32, borderRadius: T.r.pill, border: 0, background: T.surfaceAlt,
                color: T.inkMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 3 }}>{subtitle}</div>
            )}
          </div>
          <button
            type="button" onClick={handleClose} aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: T.r.pill, border: 0, background: T.surfaceAlt,
              color: T.inkMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {inReview && review ? (
          <NotificationReview
            batch={review}
            onResolved={() => handleResolved(review.key)}
          />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 22px' }}>
            {actionable.length === 0 ? (
              <div style={{ padding: '48px 0 60px', textAlign: 'center', color: T.inkMuted, fontSize: 14 }}>
                Nothing left to review ✦
              </div>
            ) : (
              <AttentionList batches={actionable} onSelect={setReview} />
            )}
          </div>
        )}
      </div>
    </ModalOrSheet>
  )
}
