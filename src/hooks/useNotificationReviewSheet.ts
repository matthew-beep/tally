import { useState } from 'react'
import type { NotificationBatch } from '@/types'

/** Open/close + list-vs-review state for NotificationsSheet. Shared by every
 * surface that mounts the sheet (home rail, group-detail bell) so they can't
 * drift on the open/openReview/close contract. */
export function useNotificationReviewSheet() {
  const [open, setOpen] = useState(false)
  const [initialReview, setInitialReview] = useState<NotificationBatch | null>(null)

  function openList() {
    setInitialReview(null)
    setOpen(true)
  }

  function openReview(batch: NotificationBatch) {
    setInitialReview(batch)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setInitialReview(null)
  }

  return { open, initialReview, openList, openReview, close }
}
