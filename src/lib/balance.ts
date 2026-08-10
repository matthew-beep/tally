import { round2 } from './money'
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

export interface ExpenseNet {
  memberId: string
  /** Their share of this one expense. */
  owed: number
  /** + they fronted this much for others, − they owe the payer this much. */
  net: number
}

/**
 * One expense's effect on each participant, from that expense alone.
 *
 * This is the detail-sheet view of an expense: the payer sees what they're out
 * of pocket for everyone else, each other participant sees what they owe. It is
 * NOT a balance — settlements and every other expense are deliberately absent.
 *
 * The payer always gets a row even when they hold no split of their own (they
 * paid for a meal they didn't eat), which is why this can't be written as the
 * obvious `amount − amountPerHead`.
 *
 * Pass `memberOrder` (the group's member array) to keep row order — and so
 * avatar colour slots — consistent with every other screen.
 */
export function calcExpenseNets(
  expense: Pick<Expense, 'amount' | 'paid_by' | 'splits'>,
  memberOrder?: string[]
): ExpenseNet[] {
  const owedBy = new Map<string, number>()
  for (const s of expense.splits ?? []) {
    owedBy.set(s.group_member_id, (owedBy.get(s.group_member_id) ?? 0) + Number(s.owed_amount))
  }
  if (!owedBy.has(expense.paid_by)) owedBy.set(expense.paid_by, 0)

  const amount = Number(expense.amount)
  const rows: ExpenseNet[] = [...owedBy].map(([memberId, owed]) => ({
    memberId,
    owed: round2(owed),
    net: round2((memberId === expense.paid_by ? amount : 0) - owed),
  }))

  if (!memberOrder) return rows
  // Participants missing from the group list (e.g. a removed seat) sort last
  // rather than jumping to the front on indexOf's -1.
  const rank = (id: string) => {
    const i = memberOrder.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return rows.sort((a, b) => rank(a.memberId) - rank(b.memberId))
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
