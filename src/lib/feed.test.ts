import { describe, it, expect } from 'vitest'
import { mergeFeed } from './feed'
import type { Expense, Settlement } from '@/types'

// mergeFeed(expenses, settlements) → one timeline, newest first, each entry
// tagged { type: 'expense' | 'settlement', data }. Sort key is created_at —
// bucketing (by month, by group) is the consumer's job, not mergeFeed's.

function expense(created_at: string, over: Partial<Expense> = {}): Expense {
  return {
    id: 'e-' + Math.random().toString(36).slice(2),
    group_id: 'g1',
    paid_by: 'a',
    description: 'test',
    amount: 10,
    expense_date: created_at.slice(0, 10),
    created_at,
    updated_at: created_at,
    deleted_at: null,
    ...over,
  } as Expense
}

function settlement(created_at: string, over: Partial<Settlement> = {}): Settlement {
  return {
    id: 's-' + Math.random().toString(36).slice(2),
    group_id: 'g1',
    from_member_id: 'a',
    to_member_id: 'b',
    amount: 5,
    settled_date: created_at.slice(0, 10),
    created_at,
    status: 'pending',
    ...over,
  } as Settlement
}

describe('mergeFeed', () => {
  it('interleaves expenses and settlements sorted by created_at, newest first', () => {
    const e1 = expense('2026-07-01T10:00:00Z')
    const e2 = expense('2026-07-03T10:00:00Z')
    const s1 = settlement('2026-07-02T10:00:00Z')
    const s2 = settlement('2026-07-04T10:00:00Z')

    const feed = mergeFeed([e1, e2], [s1, s2])
    expect(feed.map(f => f.data.id)).toEqual([s2.id, e2.id, s1.id, e1.id])
  })

  it('tags each entry with its source type', () => {
    const e = expense('2026-07-01T10:00:00Z')
    const s = settlement('2026-07-02T10:00:00Z')

    const feed = mergeFeed([e], [s])
    expect(feed).toEqual([
      { type: 'settlement', data: s },
      { type: 'expense', data: e },
    ])
  })

  it('excludes soft-deleted expenses', () => {
    const kept = expense('2026-07-01T10:00:00Z')
    const deleted = expense('2026-07-02T10:00:00Z', { deleted_at: '2026-07-05T00:00:00Z' })

    const feed = mergeFeed([kept, deleted], [])
    expect(feed.map(f => f.data.id)).toEqual([kept.id])
  })

  it('keeps settlements of every status', () => {
    const pending = settlement('2026-07-01T10:00:00Z', { status: 'pending' })
    const confirmed = settlement('2026-07-02T10:00:00Z', { status: 'confirmed' })

    const feed = mergeFeed([], [pending, confirmed])
    expect(feed.map(f => f.data.id)).toEqual([confirmed.id, pending.id])
  })

  it('returns [] for empty inputs', () => {
    expect(mergeFeed([], [])).toEqual([])
  })

  it('sorts by created_at even when expense_date disagrees (backdated expense)', () => {
    // Logged today about last month — must surface at the top of the feed,
    // not buried under the old date. created_at wins; expense_date is
    // display/bucketing metadata only.
    const backdated = expense('2026-07-10T10:00:00Z', { expense_date: '2026-06-01' })
    const older = expense('2026-07-05T10:00:00Z')

    const feed = mergeFeed([backdated, older], [])
    expect(feed.map(f => f.data.id)).toEqual([backdated.id, older.id])
  })
})
