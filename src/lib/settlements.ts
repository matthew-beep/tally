import { round2 } from './money'

/**
 * One group's share of a single payment. A settle-all across three groups is
 * three of these; a plain one-group settle is one.
 *
 * Both seat ids ride on each allocation because settlements FK to
 * `group_members`, not `profiles` — my seat differs in every group, so it
 * cannot be hoisted to the batch.
 */
export interface SettlementAllocation {
  groupId: string
  mySeatId: string           // my seat in THIS group
  theirSeatId: string        // the counterparty's seat in this group
  amount: number             // gross for this group, always positive
  direction: 'owe' | 'owed'  // 'owe' = I pay them, 'owed' = they paid me
}

/** A `settlements` row, ready to insert. */
export interface SettlementRow {
  group_id: string
  from_member_id: string
  to_member_id: string
  amount: number
  note: string | null
  settled_date: string
  status: 'pending' | 'confirmed'
  batch_id: string
}

/**
 * Signed net of a batch from my perspective: positive = they paid me on
 * balance, negative = I paid them on balance.
 *
 * This is the money that actually moves. The allocations themselves are gross
 * — that's what zeroes each group — so the two figures differ whenever a batch
 * mixes directions, and both are worth showing (TODO.md item 5 (b)).
 */
export function batchNet(allocations: SettlementAllocation[]): number {
  return round2(
    allocations.reduce((sum, a) => sum + (a.direction === 'owed' ? a.amount : -a.amount), 0)
  )
}

/**
 * Confirmation status for a whole batch, per TODO.md item 5 (a′).
 *
 * The test is *does my claim improve my own financial position?* — asked once
 * per payment, not once per allocation. A batch netting to "I paid you" is
 * self-serving and needs the payee's assent (`pending`); one netting to "you
 * paid me" costs me, so there is nobody to protect (`confirmed`, FYI only).
 *
 * Applying the test per row breaks on mixed-direction batches: two `pending`
 * rows summing to $40 would ask the payee to vouch for a $40 transfer when the
 * net actually sent was $20. Uniform status is what keeps the thing being
 * confirmed and the thing that happened the same thing.
 *
 * Net zero → `confirmed`. No money moves and neither party's aggregate
 * position changes, so there is nothing to assent to; the alternative asks
 * someone to confirm a payment of $0. Unreachable from the UI today — the
 * dashboard gates out net-zero counterparties — but defined here rather than
 * left to fall out of a sign test.
 */
export function batchStatus(allocations: SettlementAllocation[]): 'pending' | 'confirmed' {
  return batchNet(allocations) >= 0 ? 'confirmed' : 'pending'
}

/**
 * Build the rows for one payment. Every row carries the same `batch_id` and
 * the same status — that shared identity is what lets the notification list
 * collapse N rows into one card, and what makes confirm/deny act on the whole
 * payment rather than on one group's slice of it (item 5 (d)).
 *
 * `batchId` is injected rather than generated here so this stays pure and
 * testable; callers pass `crypto.randomUUID()`.
 */
export function buildSettlementBatch(
  allocations: SettlementAllocation[],
  { batchId, note, settledDate }: { batchId: string; note?: string; settledDate?: string },
): SettlementRow[] {
  // Sub-cent allocations are rounding residue, not debts — and
  // `settlements_amount_check` (amount > 0) would reject a $0.00 row, aborting
  // the entire multi-row INSERT along with the real allocations in it. Mirrors
  // the `>= 0.01` filter callers already apply when building their parts list.
  const live = allocations.filter(a => round2(a.amount) >= 0.01)
  if (live.length === 0) return []

  // Computed from the live rows, so dropped residue can never flip the sign.
  const status = batchStatus(live)
  const settled_date = settledDate ?? new Date().toISOString().slice(0, 10)

  return live.map(a => ({
    group_id: a.groupId,
    // 'owe' = I am paying them, so the money leaves my seat.
    from_member_id: a.direction === 'owe' ? a.mySeatId : a.theirSeatId,
    to_member_id:   a.direction === 'owe' ? a.theirSeatId : a.mySeatId,
    amount: round2(a.amount),
    note: note?.trim() || null,
    settled_date,
    status,
    batch_id: batchId,
  }))
}
