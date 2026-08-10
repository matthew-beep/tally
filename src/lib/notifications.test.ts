import { describe, it, expect } from 'vitest'
import {
  groupNotifications,
  batchSettlementIds,
  batchNotificationIds,
  batchGroupIds,
} from './notifications'
import type { Notification, Settlement } from '@/types'

const ME = 'profile-me'
const THEM = 'profile-them'

// A settlement as the notification query returns it: both seats hydrated with
// their profile's user_id, which is how direction is resolved.
function settlement(
  id: string,
  groupId: string,
  amount: number,
  { toMe }: { toMe: boolean },
  batchId = 'batch-1',
): Settlement {
  const seat = (userId: string) => ({
    id: `${groupId}-${userId}`,
    group_id: groupId,
    name: userId,
    user_id: userId,
    status: 'active' as const,
    invited_by: null,
    joined_at: '2026-08-09',
  })
  return {
    id,
    group_id: groupId,
    from_member_id: `${groupId}-from`,
    to_member_id: `${groupId}-to`,
    amount,
    note: null,
    settled_date: '2026-08-09',
    created_at: '2026-08-09T00:00:00Z',
    status: 'pending',
    batch_id: batchId,
    from_member: seat(toMe ? THEM : ME),
    to_member: seat(toMe ? ME : THEM),
  }
}

function notification(
  id: string,
  type: Notification['type'],
  { batchId = null, s = undefined, amount = null }:
    { batchId?: string | null; s?: Settlement; amount?: number | null } = {},
): Notification {
  return {
    id,
    recipient_id: ME,
    type,
    settlement_id: s?.id ?? null,
    group_id: null,
    amount: amount ?? (s ? Number(s.amount) : null),
    batch_id: batchId,
    read: false,
    created_at: '2026-08-09T00:00:00Z',
    settlement: s,
  }
}

describe('groupNotifications', () => {
  it('collapses rows sharing a batch_id into one entry', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: true })
    const b = settlement('s2', 'bigsur', 15, { toMe: true })
    const batches = groupNotifications(
      [
        notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: a }),
        notification('n2', 'settlement_confirm', { batchId: 'batch-1', s: b }),
      ],
      ME,
    )
    expect(batches).toHaveLength(1)
    expect(batches[0].notifications).toHaveLength(2)
    expect(batches[0].settlements).toHaveLength(2)
  })

  it('keeps separate batches separate', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: true }, 'batch-1')
    const b = settlement('s2', 'bigsur', 15, { toMe: true }, 'batch-2')
    const batches = groupNotifications(
      [
        notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: a }),
        notification('n2', 'settlement_confirm', { batchId: 'batch-2', s: b }),
      ],
      ME,
    )
    expect(batches).toHaveLength(2)
  })

  it('never merges two batch-less invites into one card', () => {
    // Both have batch_id null; keying on that alone would collapse them.
    const batches = groupNotifications(
      [notification('n1', 'group_invite'), notification('n2', 'group_invite')],
      ME,
    )
    expect(batches).toHaveLength(2)
    expect(batches.map(b => b.key)).toEqual(['single:n1', 'single:n2'])
  })

  it('preserves input order, newest batch first', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: true }, 'batch-2')
    const batches = groupNotifications(
      [
        notification('n1', 'settlement_confirm', { batchId: 'batch-2', s: a }),
        notification('n2', 'group_invite'),
      ],
      ME,
    )
    expect(batches.map(b => b.key)).toEqual(['batch-2', 'single:n2'])
  })

  it('sums gross across the batch', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: true })
    const b = settlement('s2', 'bigsur', 20, { toMe: false })
    const [batch] = groupNotifications(
      [
        notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: a }),
        notification('n2', 'settlement_confirm', { batchId: 'batch-1', s: b }),
      ],
      ME,
    )
    // Gross is what zeroes each group: $50 allocated even though $10 moves.
    expect(batch.amount).toBe(50)
  })

  it('nets signed by which seat is mine, not by gross', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: true })
    const b = settlement('s2', 'bigsur', 20, { toMe: false })
    const [batch] = groupNotifications(
      [
        notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: a }),
        notification('n2', 'settlement_confirm', { batchId: 'batch-1', s: b }),
      ],
      ME,
    )
    expect(batch.net).toBe(10)
  })

  it('nets negative when the batch sends money away from me', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: false })
    const [batch] = groupNotifications(
      [notification('n1', 'settlement_recorded', { batchId: 'batch-1', s: a })],
      ME,
    )
    expect(batch.net).toBe(-30)
  })

  it('falls back to the denormalized amount when the settlement is gone', () => {
    // settlement_denied carries no settlement_id by construction — the row is
    // deleted before the trigger fires.
    const [batch] = groupNotifications(
      [notification('n1', 'settlement_denied', { batchId: 'batch-1', amount: 45 })],
      ME,
    )
    expect(batch.amount).toBe(45)
    expect(batch.settlements).toEqual([])
  })

  it('reports net as null when no settlements survive to give it direction', () => {
    const [batch] = groupNotifications(
      [notification('n1', 'settlement_denied', { batchId: 'batch-1', amount: 45 })],
      ME,
    )
    expect(batch.net).toBeNull()
  })

  it('still groups a denied batch, which is the case the join could not', () => {
    const batches = groupNotifications(
      [
        notification('n1', 'settlement_denied', { batchId: 'batch-1', amount: 30 }),
        notification('n2', 'settlement_denied', { batchId: 'batch-1', amount: 15 }),
      ],
      ME,
    )
    expect(batches).toHaveLength(1)
    expect(batches[0].amount).toBe(45)
  })

  it('carries the type through from the batch rows', () => {
    const a = settlement('s1', 'apartment', 30, { toMe: true })
    const [batch] = groupNotifications(
      [notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: a })],
      ME,
    )
    expect(batch.type).toBe('settlement_confirm')
    expect(batch.batchId).toBe('batch-1')
  })

  it('returns nothing for no rows', () => {
    expect(groupNotifications([], ME)).toEqual([])
  })
})

describe('batch id helpers', () => {
  const a = settlement('s1', 'apartment', 30, { toMe: true })
  const b = settlement('s2', 'bigsur', 15, { toMe: true })
  const [batch] = groupNotifications(
    [
      notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: a }),
      notification('n2', 'settlement_confirm', { batchId: 'batch-1', s: b }),
    ],
    ME,
  )

  it('collects every settlement id, so confirm/deny act on the whole payment', () => {
    expect(batchSettlementIds(batch)).toEqual(['s1', 's2'])
  })

  it('collects every notification id, so the card retires in one go', () => {
    expect(batchNotificationIds(batch)).toEqual(['n1', 'n2'])
  })

  it('collects distinct group ids for cache invalidation', () => {
    expect(batchGroupIds(batch)).toEqual(['apartment', 'bigsur'])
  })

  it('de-duplicates groups when a batch touches one twice', () => {
    const x = settlement('s1', 'apartment', 30, { toMe: true })
    const y = settlement('s2', 'apartment', 15, { toMe: true })
    const [one] = groupNotifications(
      [
        notification('n1', 'settlement_confirm', { batchId: 'batch-1', s: x }),
        notification('n2', 'settlement_confirm', { batchId: 'batch-1', s: y }),
      ],
      ME,
    )
    expect(batchGroupIds(one)).toEqual(['apartment'])
  })
})
