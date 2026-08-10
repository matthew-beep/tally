import { describe, it, expect } from 'vitest'
import { toActivityCard, toGroupFeedCard } from './feedCards'
import type { ActivityItem, Expense, GroupMember, Settlement } from '@/types'
import type { FeedItem } from './feed'

const members = [
  { id: 'm1', group_id: 'g', name: 'Ada Lovelace', user_id: 'u1', status: 'active', invited_by: null, joined_at: '' },
  { id: 'm2', group_id: 'g', name: 'Sam Reed',     user_id: 'u2', status: 'active', invited_by: null, joined_at: '' },
  { id: 'm3', group_id: 'g', name: 'Taylor Kim',   user_id: 'u3', status: 'active', invited_by: null, joined_at: '' },
] as GroupMember[]

function expenseItem(over: Omit<Partial<Expense>, 'splits'> & { paid_by: string; splits: { group_member_id: string; owed_amount: number }[] }): FeedItem {
  return {
    type: 'expense',
    data: {
      id: 'e1', group_id: 'g', description: 'Dinner', category: '🍽️',
      amount: over.splits.reduce((a, s) => a + s.owed_amount, 0),
      created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
      expense_date: '2026-08-01', deleted_at: null,
      ...over,
      splits: over.splits.map((s, i) => ({ id: `s${i}`, expense_id: 'e1', ...s })),
    } as Expense,
  }
}

function settlementItem(over: Partial<Settlement> = {}): FeedItem {
  return {
    type: 'settlement',
    data: {
      id: 'st1', group_id: 'g', from_member_id: 'm2', to_member_id: 'm1',
      amount: 20, note: null, status: 'pending',
      settled_date: '2026-08-02', created_at: '2026-08-02T00:00:00Z',
      ...over,
    } as Settlement,
  }
}

describe('toGroupFeedCard — expenses', () => {
  it('shows the payer what everyone else owes them, not the whole total', () => {
    const card = toGroupFeedCard(expenseItem({
      paid_by: 'm1',
      splits: [
        { group_member_id: 'm1', owed_amount: 10 },
        { group_member_id: 'm2', owed_amount: 10 },
        { group_member_id: 'm3', owed_amount: 10 },
      ],
    }), members, 'm1')

    expect(card.amount).toBe(20)          // not 30 — my own split nets to nothing
    expect(card.amountTone).toBe('positive')
    expect(card.amountCaption).toBe('your share')
    expect(card.subtitle).toContain('You paid')
  })

  it('shows a non-payer their own share', () => {
    const card = toGroupFeedCard(expenseItem({
      paid_by: 'm1',
      splits: [
        { group_member_id: 'm1', owed_amount: 10 },
        { group_member_id: 'm2', owed_amount: 10 },
      ],
    }), members, 'm2')

    expect(card.amount).toBe(10)
    expect(card.amountTone).toBe('negative')
    expect(card.subtitle).toContain('Ada Lovelace paid')
  })

  it('renders no amount at all for an expense the viewer is not part of', () => {
    const card = toGroupFeedCard(expenseItem({
      paid_by: 'm1',
      splits: [
        { group_member_id: 'm1', owed_amount: 10 },
        { group_member_id: 'm2', owed_amount: 10 },
      ],
    }), members, 'm3')

    // Not $0.00 — a zero would read as a settled balance rather than "n/a".
    expect(card.amountTone).toBeUndefined()
    expect(card.amountCaption).toBeUndefined()
  })

  it('marks edited expenses', () => {
    const plain = toGroupFeedCard(expenseItem({ paid_by: 'm1', splits: [{ group_member_id: 'm1', owed_amount: 5 }] }), members, 'm1')
    expect(plain.titleTag).toBeUndefined()

    const edited = toGroupFeedCard(expenseItem({
      paid_by: 'm1', updated_at: '2026-08-05T00:00:00Z',
      splits: [{ group_member_id: 'm1', owed_amount: 5 }],
    }), members, 'm1')
    expect(edited.titleTag).toBe('(edited)')
  })

  it('carries every participant with a resolved avatar and slot', () => {
    const card = toGroupFeedCard(expenseItem({
      paid_by: 'm1',
      splits: [
        { group_member_id: 'm1', owed_amount: 5 },
        { group_member_id: 'm2', owed_amount: 5 },
      ],
    }), members, 'm2')

    expect(card.participants).toHaveLength(2)
    expect(card.participants?.[1]).toMatchObject({ id: 'm2', slot: 1, isYou: true })
    expect(card.participants?.[0].avatar.name).toBe('Ada Lovelace')
  })

  it('survives a split pointing at a member who is no longer listed', () => {
    const card = toGroupFeedCard(expenseItem({
      paid_by: 'm1',
      splits: [
        { group_member_id: 'm1', owed_amount: 5 },
        { group_member_id: 'gone', owed_amount: 5 },
      ],
    }), members, 'm1')
    expect(card.participants?.[1].avatar.name).toBe('…')
  })
})

describe('toGroupFeedCard — settlements', () => {
  it('reads from the viewer’s side', () => {
    const paid = toGroupFeedCard(settlementItem(), members, 'm2')
    expect(paid.title).toBe('You paid Ada')

    const received = toGroupFeedCard(settlementItem(), members, 'm1')
    expect(received.title).toBe('Sam paid you')

    const neither = toGroupFeedCard(settlementItem(), members, 'm3')
    expect(neither.title).toBe('Sam paid Ada')
  })

  it('tags status and tints only once confirmed', () => {
    expect(toGroupFeedCard(settlementItem(), members, 'm1')).toMatchObject({
      statusTag: 'pending', amountTone: 'neutral',
    })
    expect(toGroupFeedCard(settlementItem({ status: 'confirmed' }), members, 'm1')).toMatchObject({
      statusTag: 'confirmed', amountTone: 'positive',
    })
  })
})

describe('toActivityCard', () => {
  const base = {
    type: 'expense' as const, id: 'e1', description: 'Dinner', category: '🍽️',
    amount: 30, date: '2026-08-01', createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z', payerName: 'Sam',
    groupId: 'g', groupName: 'Big Sur', groupEmoji: '🌲',
  } satisfies ActivityItem

  it('swaps the date for the group name when showing across groups', () => {
    expect(toActivityCard(base, false).subtitle).toBe('Sam · Aug 1')
    expect(toActivityCard(base, true).subtitle).toBe('Sam · 🌲 Big Sur')
  })

  it('never claims a share — the cross-group feed has no splits', () => {
    const card = toActivityCard(base, true)
    expect(card.amount).toBe(30)
    expect(card.amountCaption).toBeUndefined()
    expect(card.participants).toBeUndefined()
  })

  it('does not shift the date across a timezone boundary', () => {
    // Parsed as local midnight, not UTC — otherwise this renders as Jul 31.
    expect(toActivityCard({ ...base, date: '2026-08-01' }, false).subtitle).toContain('Aug 1')
  })
})
