import type { Expense, Settlement, DebtTransfer } from '@/types'

export function calcNetBalances(
  groupId: string,
  expenses: Expense[],
  settlements: Settlement[],
  memberIds: string[]
): Record<string, number> {
  const net = Object.fromEntries(memberIds.map(id => [id, 0]))

  expenses
    .filter(e => e.group_id === groupId && !e.deleted_at)
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
// ±0.01 count as settled — the same epsilon simplifyDebts uses.
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

export function simplifyDebts(net: Record<string, number>): DebtTransfer[] {
  const debtors = Object.entries(net)
    .filter(([, v]) => v < -0.01)
    .map(([uid, v]) => ({ uid, amt: -v }))
    .sort((a, b) => b.amt - a.amt)

  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0.01)
    .map(([uid, v]) => ({ uid, amt: v }))
    .sort((a, b) => b.amt - a.amt)

  const out: DebtTransfer[] = []
  let d = 0, c = 0

  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].amt, creditors[c].amt)
    out.push({
      from: debtors[d].uid,
      to: creditors[c].uid,
      amount: Math.round(pay * 100) / 100,
    })
    debtors[d].amt -= pay
    creditors[c].amt -= pay
    if (debtors[d].amt < 0.01) d++
    if (creditors[c].amt < 0.01) c++
  }

  return out
}

export function calcPairwiseNets(memberId: string, expenses: Expense[], settlements: Settlement[]): Record<string, number> {
  expenses = expenses.filter(e => e.deleted_at === null)

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
