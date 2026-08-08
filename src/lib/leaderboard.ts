import { isLive } from './balance'
import { round2 } from './money'
import type { Expense } from '@/types'

export interface LeaderboardEntry {
  memberId: string
  /** Gross amount this seat fronted. NOT a balance — settlements never touch it. */
  paid: number
  /** How many expenses they fronted. */
  txns: number
}

/**
 * Who fronted the most, ranked. Derived entirely from expenses already in
 * cache — nothing is stored, and nothing here feeds a balance.
 *
 * `paid` is deliberately gross: it answers "who has been covering the group",
 * which is a fact about generosity, not a claim about debt. Settlements are
 * not subtracted, because paying someone back doesn't un-front the dinner.
 * Net standing is `calcNetBalances`' job and is shown separately.
 *
 * Every seat passed in gets an entry, including pending, left, and guest
 * seats — they fronted real money, so hiding them would misstate the total.
 * Sorted by `paid` descending; the sort is stable, so ties keep the order of
 * `memberIds` (which callers derive from the group's member list, the same
 * ordering that drives avatar slots).
 */
export function calcLeaderboard(
  groupId: string,
  expenses: Expense[],
  memberIds: string[]
): LeaderboardEntry[] {
  const paid = Object.fromEntries(memberIds.map(id => [id, 0]))
  const txns = Object.fromEntries(memberIds.map(id => [id, 0]))

  expenses
    .filter(e => e.group_id === groupId && isLive(e))
    .forEach(e => {
      if (!(e.paid_by in paid)) return  // payer's seat isn't in the list — skip, don't invent a row
      paid[e.paid_by] += Number(e.amount)
      txns[e.paid_by] += 1
    })

  return memberIds
    .map(id => ({ memberId: id, paid: round2(paid[id]), txns: txns[id] }))
    .sort((a, b) => b.paid - a.paid)
}
