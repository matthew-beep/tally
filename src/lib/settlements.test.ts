import { describe, it, expect } from 'vitest'
import { batchNet, batchStatus, buildSettlementBatch, type SettlementAllocation } from './settlements'

// Helper: one allocation. Positive amount + direction from my perspective.
// Seat ids are per-group by construction — mine differs in every group, which
// is the whole reason they live on the allocation rather than the batch.
const alloc = (
  groupId: string,
  amount: number,
  direction: 'owe' | 'owed',
): SettlementAllocation => ({
  groupId,
  mySeatId: `${groupId}-me`,
  theirSeatId: `${groupId}-them`,
  amount,
  direction,
})

const OPTS = { batchId: 'batch-1', settledDate: '2026-08-09' }

describe('batchNet', () => {
  it('is negative when I owe on balance', () => {
    expect(batchNet([alloc('apartment', 25, 'owe'), alloc('bigsur', 15, 'owe')])).toBe(-40)
  })

  it('is positive when they owe me on balance', () => {
    expect(batchNet([alloc('apartment', 40, 'owed'), alloc('bigsur', 20, 'owed')])).toBe(60)
  })

  it('nets opposing directions rather than summing them', () => {
    // Gross is $50 across two groups; the money that actually moves is $10.
    expect(batchNet([alloc('apartment', 30, 'owe'), alloc('bigsur', 20, 'owed')])).toBe(-10)
  })

  it('rounds to cents', () => {
    expect(batchNet([alloc('a', 0.1, 'owed'), alloc('b', 0.2, 'owed')])).toBe(0.3)
  })
})

describe('batchStatus', () => {
  it('is pending when the batch nets to me paying — the claim is self-serving', () => {
    expect(batchStatus([alloc('apartment', 25, 'owe'), alloc('bigsur', 15, 'owe')])).toBe('pending')
  })

  it('is confirmed when the batch nets to them paying — the claim costs me', () => {
    expect(batchStatus([alloc('apartment', 40, 'owed')])).toBe('confirmed')
  })

  it('follows the net, not the presence of a pending-direction row', () => {
    // The rejected "any row pending → batch pending" rule inverts exactly here:
    // Alex owes me $50 in one group, I owe $10 in another. Alex is paying me
    // $40 on balance, so asking Alex to confirm would ask them to vouch for a
    // payment they are receiving credit for.
    const batch = [alloc('apartment', 50, 'owed'), alloc('bigsur', 10, 'owe')]
    expect(batchNet(batch)).toBe(40)
    expect(batchStatus(batch)).toBe('confirmed')
  })

  it('is pending when a mixed batch still nets to me paying', () => {
    const batch = [alloc('apartment', 30, 'owe'), alloc('bigsur', 20, 'owed')]
    expect(batchNet(batch)).toBe(-10)
    expect(batchStatus(batch)).toBe('pending')
  })

  it('treats an exactly-offsetting batch as confirmed, not pending', () => {
    // Nothing moves, so there is nothing to assent to — confirming a $0
    // payment is the alternative.
    const batch = [alloc('apartment', 40, 'owed'), alloc('bigsur', 40, 'owe')]
    expect(batchNet(batch)).toBe(0)
    expect(batchStatus(batch)).toBe('confirmed')
  })
})

describe('buildSettlementBatch', () => {
  it('sends money from my seat when I am paying', () => {
    const [row] = buildSettlementBatch([alloc('apartment', 30, 'owe')], OPTS)
    expect(row.from_member_id).toBe('apartment-me')
    expect(row.to_member_id).toBe('apartment-them')
  })

  it('sends money from their seat when they paid me', () => {
    const [row] = buildSettlementBatch([alloc('apartment', 30, 'owed')], OPTS)
    expect(row.from_member_id).toBe('apartment-them')
    expect(row.to_member_id).toBe('apartment-me')
  })

  it('uses each group its own seat ids', () => {
    const rows = buildSettlementBatch(
      [alloc('apartment', 30, 'owe'), alloc('bigsur', 20, 'owe')],
      OPTS,
    )
    expect(rows.map(r => r.from_member_id)).toEqual(['apartment-me', 'bigsur-me'])
    expect(rows.map(r => r.group_id)).toEqual(['apartment', 'bigsur'])
  })

  it('stamps one batch_id and one status across every row', () => {
    const rows = buildSettlementBatch(
      [alloc('apartment', 50, 'owed'), alloc('bigsur', 10, 'owe'), alloc('dinner', 5, 'owe')],
      OPTS,
    )
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map(r => r.batch_id)).size).toBe(1)
    expect(new Set(rows.map(r => r.status)).size).toBe(1)
    // Nets to +35 → they paid me on balance → confirmed.
    expect(rows[0].status).toBe('confirmed')
  })

  it('keeps allocations gross — rows are not netted against each other', () => {
    // The $10 offset does not shrink the $30 row; each group is zeroed at its
    // own full balance, which is what makes settle-all actually settle.
    const rows = buildSettlementBatch(
      [alloc('apartment', 30, 'owe'), alloc('bigsur', 10, 'owed')],
      OPTS,
    )
    expect(rows.map(r => r.amount)).toEqual([30, 10])
  })

  it('rounds amounts to cents', () => {
    const [row] = buildSettlementBatch([alloc('apartment', 10.005, 'owe')], OPTS)
    expect(row.amount).toBe(10.01)
  })

  it('drops sub-cent residue but keeps the real allocations', () => {
    const rows = buildSettlementBatch(
      [alloc('apartment', 20, 'owe'), alloc('bigsur', 0.004, 'owe')],
      OPTS,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].group_id).toBe('apartment')
  })

  it('does not let dropped residue flip the batch status', () => {
    // The residue is an 'owed' row large enough to matter only if it survived.
    const rows = buildSettlementBatch(
      [alloc('apartment', 0.004, 'owed'), alloc('bigsur', 10, 'owe')],
      OPTS,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })

  it('returns [] when every allocation is sub-cent', () => {
    expect(buildSettlementBatch([alloc('apartment', 0.001, 'owe')], OPTS)).toEqual([])
  })

  it('returns [] for no allocations', () => {
    expect(buildSettlementBatch([], OPTS)).toEqual([])
  })

  it('carries the note onto every row, so each group feed reads on its own', () => {
    const rows = buildSettlementBatch(
      [alloc('apartment', 30, 'owe'), alloc('bigsur', 20, 'owe')],
      { ...OPTS, note: '  Venmo  ' },
    )
    expect(rows.every(r => r.note === 'Venmo')).toBe(true)
  })

  it('stores a blank note as null rather than an empty string', () => {
    const [row] = buildSettlementBatch([alloc('apartment', 30, 'owe')], { ...OPTS, note: '   ' })
    expect(row.note).toBeNull()
  })

  it('defaults settled_date to today when the caller does not set one', () => {
    const [row] = buildSettlementBatch([alloc('apartment', 30, 'owe')], { batchId: 'b' })
    expect(row.settled_date).toBe(new Date().toISOString().slice(0, 10))
  })
})
