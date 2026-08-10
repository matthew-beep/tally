import { describe, it, expect } from 'vitest'
import { groupReactions, toggleReaction, hasReacted, type ReactionsByExpense } from './reactions'

function row(expense_id: string, group_member_id: string, emoji: string, created_at: string) {
  return { expense_id, group_member_id, emoji, created_at }
}

describe('groupReactions', () => {
  it('folds rows into per-expense emoji groups', () => {
    expect(groupReactions([
      row('e1', 'a', '😍', '2026-08-01T10:00:00Z'),
      row('e1', 'b', '😍', '2026-08-01T11:00:00Z'),
      row('e1', 'a', '🔥', '2026-08-01T12:00:00Z'),
      row('e2', 'c', '🙏', '2026-08-01T13:00:00Z'),
    ])).toEqual({
      e1: [{ emoji: '😍', memberIds: ['a', 'b'] }, { emoji: '🔥', memberIds: ['a'] }],
      e2: [{ emoji: '🙏', memberIds: ['c'] }],
    })
  })

  it('omits expenses with no reactions rather than storing empty arrays', () => {
    expect(groupReactions([])).toEqual({})
  })

  it('orders emoji by first appearance regardless of input order', () => {
    const out = groupReactions([
      row('e1', 'c', '🔥', '2026-08-01T12:00:00Z'),
      row('e1', 'a', '😍', '2026-08-01T10:00:00Z'),
      row('e1', 'b', '🔥', '2026-08-01T11:00:00Z'),
    ])
    // 😍 is oldest overall, so it leads — even though 🔥 came first in the array.
    expect(out.e1.map(g => g.emoji)).toEqual(['😍', '🔥'])
    expect(out.e1[1].memberIds).toEqual(['b', 'c'])
  })

  it('does not order by count', () => {
    const out = groupReactions([
      row('e1', 'a', '😍', '2026-08-01T10:00:00Z'),
      row('e1', 'b', '🔥', '2026-08-01T11:00:00Z'),
      row('e1', 'c', '🔥', '2026-08-01T12:00:00Z'),
    ])
    expect(out.e1.map(g => g.emoji)).toEqual(['😍', '🔥'])
  })
})

describe('toggleReaction', () => {
  const base: ReactionsByExpense = {
    e1: [{ emoji: '😍', memberIds: ['a', 'b'] }, { emoji: '🔥', memberIds: ['a'] }],
  }

  it('adds a brand-new emoji to an expense that has none', () => {
    expect(toggleReaction({}, 'e9', '💸', 'a')).toEqual({
      e9: [{ emoji: '💸', memberIds: ['a'] }],
    })
  })

  it('joins an emoji someone else already used', () => {
    expect(toggleReaction(base, 'e1', '🔥', 'c').e1).toEqual([
      { emoji: '😍', memberIds: ['a', 'b'] },
      { emoji: '🔥', memberIds: ['a', 'c'] },
    ])
  })

  it('appends a new emoji after the existing ones', () => {
    expect(toggleReaction(base, 'e1', '👀', 'c').e1.map(g => g.emoji)).toEqual(['😍', '🔥', '👀'])
  })

  it('removes only my own reaction, leaving the group standing', () => {
    expect(toggleReaction(base, 'e1', '😍', 'a').e1).toEqual([
      { emoji: '😍', memberIds: ['b'] },
      { emoji: '🔥', memberIds: ['a'] },
    ])
  })

  it('drops the emoji entirely when the last person removes it', () => {
    expect(toggleReaction(base, 'e1', '🔥', 'a').e1).toEqual([
      { emoji: '😍', memberIds: ['a', 'b'] },
    ])
  })

  it('drops the expense key when its last reaction goes', () => {
    const single: ReactionsByExpense = { e1: [{ emoji: '🔥', memberIds: ['a'] }] }
    expect(toggleReaction(single, 'e1', '🔥', 'a')).toEqual({})
  })

  it('round-trips membership — toggling twice adds and loses nobody', () => {
    const members = (s: ReactionsByExpense) =>
      Object.fromEntries((s.e1 ?? []).map(g => [g.emoji, [...g.memberIds].sort()]))

    for (const [emoji, seat] of [['😍', 'a'], ['🔥', 'a'], ['👀', 'z'], ['🔥', 'c']] as const) {
      const once  = toggleReaction(base, 'e1', emoji, seat)
      const twice = toggleReaction(once, 'e1', emoji, seat)
      expect(members(twice), `${emoji}/${seat}`).toEqual(members(base))
    }
  })

  it('re-reacting moves you to the end, matching the server’s created_at order', () => {
    // Order within a group is recency, so a round trip is NOT order-preserving.
    const off = toggleReaction(base, 'e1', '😍', 'a')
    const on  = toggleReaction(off, 'e1', '😍', 'a')
    expect(on.e1[0].memberIds).toEqual(['b', 'a'])
    expect(on.e1[0].memberIds).toEqual(
      groupReactions([
        row('e1', 'b', '😍', '2026-08-01T11:00:00Z'),
        row('e1', 'a', '😍', '2026-08-02T09:00:00Z'), // the re-reaction's new row
      ]).e1[0].memberIds
    )
  })

  it('leaves other expenses untouched', () => {
    const two: ReactionsByExpense = { ...base, e2: [{ emoji: '🙏', memberIds: ['c'] }] }
    const out = toggleReaction(two, 'e1', '👀', 'a')
    expect(out.e2).toBe(two.e2)
  })

  it('does not mutate its input', () => {
    const snapshot = JSON.parse(JSON.stringify(base))
    toggleReaction(base, 'e1', '😍', 'a')
    toggleReaction(base, 'e1', '👀', 'z')
    expect(base).toEqual(snapshot)
  })

  it('returns a new top-level object so cache identity changes', () => {
    expect(toggleReaction(base, 'e1', '👀', 'a')).not.toBe(base)
  })

  it('agrees with what the server would produce for the same state', () => {
    // Optimistically add, then rebuild from the rows that write would create.
    const optimistic = toggleReaction(base, 'e1', '👀', 'c')
    const fromServer = groupReactions([
      row('e1', 'a', '😍', '2026-08-01T10:00:00Z'),
      row('e1', 'b', '😍', '2026-08-01T11:00:00Z'),
      row('e1', 'a', '🔥', '2026-08-01T12:00:00Z'),
      row('e1', 'c', '👀', '2026-08-01T13:00:00Z'),
    ])
    expect(optimistic).toEqual(fromServer)
  })
})

describe('hasReacted', () => {
  const groups = [{ emoji: '😍', memberIds: ['a', 'b'] }]

  it('is true only for a seat holding that emoji', () => {
    expect(hasReacted(groups, '😍', 'a')).toBe(true)
    expect(hasReacted(groups, '😍', 'z')).toBe(false)
    expect(hasReacted(groups, '🔥', 'a')).toBe(false)
  })

  it('is false for an expense with no reactions', () => {
    expect(hasReacted(undefined, '😍', 'a')).toBe(false)
  })
})
