import type { Expense, Settlement } from '@/types'

/**
 * Soft-delete invariant: deleted expenses are invisible to every balance
 * calculation. One predicate so the two entry points below can't drift.
 * Truthiness rather than `=== null` — a partially-selected row can carry
 * `undefined` here, which `=== null` would wrongly treat as deleted.
 */
export function isLive(e: Pick<Expense, 'deleted_at'>): boolean {
  return !e.deleted_at
}

export function calcNetBalances(
  groupId: string,
  expenses: Expense[],
  settlements: Settlement[],
  memberIds: string[]
): Record<string, number> {
  const net = Object.fromEntries(memberIds.map(id => [id, 0]))

  expenses
    .filter(e => e.group_id === groupId && isLive(e))
    .forEach(e => {
      e.splits?.forEach(s => {
        if (s.group_member_id === e.paid_by) return
        net[e.paid_by] = (net[e.paid_by] ?? 0) + s.owed_amount
        net[s.group_member_id] = (net[s.group_member_id] ?? 0) - s.owed_amount
      })
    })

  settlements
    .filter(s => s.group_id === groupId)
    .forEach(s => {
      net[s.from_member_id] = (net[s.from_member_id] ?? 0) + s.amount
      net[s.to_member_id]   = (net[s.to_member_id]   ?? 0) - s.amount
    })

  return Object.fromEntries(
    Object.entries(net).map(([k, v]) => [k, Math.round(v * 100) / 100])
  )
}

// Collapses one member's pairwise map into hero numbers. owedToMe and iOwe
// are gross magnitudes (both positive); net = owedToMe - iOwe. Entries within
// ±0.01 count as settled.
export function summarizeBalances(
  pairwise: Record<string, number>
): { owedToMe: number; iOwe: number; net: number } {
  let owedToMe = 0
  let iOwe = 0
  for (const v of Object.values(pairwise)) {
    if (v > 0.01) owedToMe += v
    else if (v < -0.01) iOwe -= v
  }
  owedToMe = Math.round(owedToMe * 100) / 100
  iOwe     = Math.round(iOwe * 100) / 100
  return { owedToMe, iOwe, net: Math.round((owedToMe - iOwe) * 100) / 100 }
}

export function calcPairwiseNets(memberId: string, expenses: Expense[], settlements: Settlement[]): Record<string, number> {
  expenses = expenses.filter(isLive)

  const net: Record<string, number> = {}

  for (const e of expenses) {
    if (e.paid_by === memberId) { // if paid by me
      for (const s of e.splits ?? []) {
        if (s.group_member_id === memberId) continue
        net[s.group_member_id] = (net[s.group_member_id] ?? 0) + s.owed_amount
      }
    } else { // if not paid by me
      for (const s of e.splits ?? []) {
        if (s.group_member_id !== memberId) continue
        net[e.paid_by] = (net[e.paid_by] ?? 0) - s.owed_amount
      }
    }
  }

  for (const s of settlements) {
    if (s.from_member_id === memberId) {
      net[s.to_member_id] = (net[s.to_member_id] ?? 0) + s.amount
    } else if (s.to_member_id === memberId) {
      net[s.from_member_id] = (net[s.from_member_id] ?? 0) - s.amount
    }
  }

  return Object.fromEntries(
    Object.entries(net).map(([k, v]) => [k, Math.round(v * 100) / 100])
  )
}
