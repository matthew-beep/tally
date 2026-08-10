import type { ExpenseReaction } from '@/types'

/** One emoji on one expense, and everyone who put it there (oldest first). */
export interface ReactionGroup {
  emoji: string
  memberIds: string[]
}

/** Keyed by expense id. An expense with no reactions has no key at all. */
export type ReactionsByExpense = Record<string, ReactionGroup[]>

type ReactionRow = Pick<ExpenseReaction, 'expense_id' | 'group_member_id' | 'emoji' | 'created_at'>

/**
 * Fold flat reaction rows into the per-expense shape the UI renders.
 *
 * There is deliberately no "did I react" set alongside this: that is
 * `memberIds.includes(mySeatId)`, and storing it separately is a second copy
 * of the same fact waiting to disagree with the first.
 *
 * Ordering is by first appearance — the emoji whose earliest reaction is
 * oldest sits leftmost, and members within a group are oldest first. That
 * keeps pills from reshuffling under the user's finger when a count changes,
 * which sorting by count would do. Sorting happens here rather than relying on
 * the query's ORDER BY, so the function is total over any input order.
 */
export function groupReactions(rows: ReactionRow[]): ReactionsByExpense {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const byExpense: ReactionsByExpense = {}
  for (const row of sorted) {
    const groups = (byExpense[row.expense_id] ??= [])
    const group = groups.find(g => g.emoji === row.emoji)
    if (group) {
      if (!group.memberIds.includes(row.group_member_id)) group.memberIds.push(row.group_member_id)
    } else {
      groups.push({ emoji: row.emoji, memberIds: [row.group_member_id] })
    }
  }
  return byExpense
}

/**
 * Apply one seat's toggle of one emoji, immutably.
 *
 * This is the optimistic update's whole brain, kept out of the mutation so it
 * can be tested without a cache: reacting removes if present and adds if not,
 * an emoji nobody holds any more disappears entirely, and an expense with no
 * reactions left drops its key. The property that matters is agreement with
 * the server — this must produce what `groupReactions` would return once the
 * write lands, or the row will visibly jump when the invalidation settles.
 *
 * Re-reacting therefore moves you to the END of the group, not back to your
 * old position: the server's new row carries a later `created_at`, so that is
 * genuinely where you now belong. A toggle round trip restores membership but
 * not order, and that is correct rather than a leak.
 *
 * Every level is copied rather than mutated; TanStack compares by reference.
 */
export function toggleReaction(
  state: ReactionsByExpense,
  expenseId: string,
  emoji: string,
  seatId: string
): ReactionsByExpense {
  const groups = state[expenseId] ?? []
  const existing = groups.find(g => g.emoji === emoji)
  const mine = existing?.memberIds.includes(seatId) ?? false

  let nextGroups: ReactionGroup[]
  if (!existing) {
    nextGroups = [...groups, { emoji, memberIds: [seatId] }]
  } else if (mine) {
    const memberIds = existing.memberIds.filter(id => id !== seatId)
    nextGroups = memberIds.length
      ? groups.map(g => (g.emoji === emoji ? { ...g, memberIds } : g))
      : groups.filter(g => g.emoji !== emoji)
  } else {
    nextGroups = groups.map(g =>
      g.emoji === emoji ? { ...g, memberIds: [...g.memberIds, seatId] } : g
    )
  }

  const next = { ...state }
  if (nextGroups.length) next[expenseId] = nextGroups
  else delete next[expenseId]
  return next
}

/** Whether `seatId` holds `emoji` on this expense. */
export function hasReacted(groups: ReactionGroup[] | undefined, emoji: string, seatId: string): boolean {
  return groups?.find(g => g.emoji === emoji)?.memberIds.includes(seatId) ?? false
}
