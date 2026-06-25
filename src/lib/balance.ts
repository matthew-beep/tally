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
