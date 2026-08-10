import { round2 } from './money'
import type { Notification, NotificationBatch, Settlement } from '@/types'

/**
 * Signed amount of one settlement from the recipient's point of view:
 * positive = money came to me, negative = money went out.
 *
 * Seats are compared by `user_id` because notifications are profile-keyed
 * while settlements are seat-keyed — the recipient holds a different
 * `group_members.id` in every group of a batch, but the same profile id
 * throughout.
 */
function signedForRecipient(s: Settlement, myProfileId: string): number {
  const amount = Number(s.amount)
  if (s.to_member?.user_id === myProfileId) return amount
  if (s.from_member?.user_id === myProfileId) return -amount
  return 0
}

/**
 * Collapse a recipient's notification rows into one entry per payment.
 *
 * Rows are grouped by `settlements.batch_id`, stamped onto the notification by
 * the triggers (`20260808000000`) rather than joined through `settlement_id` —
 * `settlement_denied` deliberately carries no `settlement_id`, so the join
 * would break for exactly the case grouping most needs to fix.
 *
 * Input order is preserved (the query sorts newest first), so the output is
 * ordered by each batch's most recent notification.
 *
 * A batch's rows always share one type: each notification type is emitted by a
 * single trigger path, and the two directions of a settlement's lifecycle go
 * to different recipients. Type is therefore taken from the first row; a mixed
 * batch would be a data bug and is deliberately not papered over here.
 */
export function groupNotifications(
  rows: Notification[],
  myProfileId: string,
): NotificationBatch[] {
  const byKey = new Map<string, NotificationBatch>()

  for (const n of rows) {
    // Rows with no batch (group invites) are batches of one. Keyed by row id
    // so two invites can never collide into a single card.
    const key = n.batch_id ?? `single:${n.id}`

    let batch = byKey.get(key)
    if (!batch) {
      batch = {
        key,
        batchId: n.batch_id,
        type: n.type,
        notifications: [],
        settlements: [],
        amount: 0,
        net: null,
      }
      byKey.set(key, batch)
    }

    batch.notifications.push(n)
    if (n.settlement) batch.settlements.push(n.settlement)
  }

  for (const batch of byKey.values()) {
    // Prefer the settlement's amount; fall back to the denormalized copy on
    // the notification, which is all that survives a denial.
    batch.amount = round2(
      batch.notifications.reduce(
        (sum, n) => sum + Math.abs(Number(n.settlement?.amount ?? n.amount ?? 0)),
        0,
      ),
    )

    // Only derivable while the settlements exist — direction lives on their
    // seats, and a denied batch has none left.
    batch.net = batch.settlements.length
      ? round2(batch.settlements.reduce((sum, s) => sum + signedForRecipient(s, myProfileId), 0))
      : null
  }

  return [...byKey.values()]
}

/** Every settlement id in a batch — what confirm/deny act on. */
export function batchSettlementIds(batch: NotificationBatch): string[] {
  return batch.settlements.map(s => s.id)
}

/** Every notification id in a batch — what gets marked read together. */
export function batchNotificationIds(batch: NotificationBatch): string[] {
  return batch.notifications.map(n => n.id)
}

/** Distinct groups a batch touches — the caches to invalidate after a write. */
export function batchGroupIds(batch: NotificationBatch): string[] {
  return [...new Set(batch.settlements.map(s => s.group_id))]
}
