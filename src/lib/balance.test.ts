import { describe, it, expect } from 'vitest'
import { calcNetBalances, simplifyDebts, calcPairwiseNets, summarizeBalances } from './balance'
import type { Expense, Settlement } from '@/types'

const G = 'group-1'

function expense(over: Omit<Partial<Expense>, 'splits'> & { paid_by: string; splits: { group_member_id: string; owed_amount: number }[] }): Expense {
  const id = 'e-' + Math.random().toString(36).slice(2)
  return {
    group_id: G,
    amount: over.splits.reduce((a, s) => a + s.owed_amount, 0),
    description: 'test',
    deleted_at: null,
    ...over,
    id,
    splits: over.splits.map((s, i) => ({ id: `${id}-s${i}`, expense_id: id, ...s })),
  } as Expense
}

function settlement(from: string, to: string, amount: number, over: Partial<Settlement> = {}): Settlement {
  return {
    id: 's-' + Math.random().toString(36).slice(2),
    group_id: G,
    from_member_id: from,
    to_member_id: to,
    amount,
    status: 'pending',
    ...over,
  } as Settlement
}

const netSum = (net: Record<string, number>) =>
  Math.round(Object.values(net).reduce((a, v) => a + v, 0) * 100) / 100 || 0 // -0 → 0

describe('calcNetBalances', () => {
  const members = ['a', 'b', 'c']

  it('credits the payer and debits the others', () => {
    const net = calcNetBalances(G, [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 10 },
        { group_member_id: 'b', owed_amount: 10 },
        { group_member_id: 'c', owed_amount: 10 },
      ]}),
    ], [], members)
    expect(net).toEqual({ a: 20, b: -10, c: -10 })
    expect(netSum(net)).toBe(0)
  })

  it('skips the payer’s own split row (no self-debt)', () => {
    const net = calcNetBalances(G, [
      expense({ paid_by: 'a', splits: [{ group_member_id: 'a', owed_amount: 30 }] }),
    ], [], members)
    expect(net).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('excludes soft-deleted expenses', () => {
    const net = calcNetBalances(G, [
      expense({
        paid_by: 'a',
        deleted_at: '2026-07-01T00:00:00Z',
        splits: [
          { group_member_id: 'a', owed_amount: 50 },
          { group_member_id: 'b', owed_amount: 50 },
        ],
      }),
    ], [], members)
    expect(net).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('ignores expenses and settlements from other groups', () => {
    const net = calcNetBalances(G, [
      expense({ group_id: 'other', paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 5 },
        { group_member_id: 'b', owed_amount: 5 },
      ]}),
    ], [settlement('b', 'a', 99, { group_id: 'other' })], members)
    expect(net).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('offsets balances with settlements, including pending ones', () => {
    const net = calcNetBalances(G, [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 10 },
        { group_member_id: 'b', owed_amount: 10 },
      ]}),
    ], [settlement('b', 'a', 10, { status: 'pending' })], members)
    expect(net).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('supports partial settlements stacking', () => {
    const net = calcNetBalances(G, [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 7.5 },
        { group_member_id: 'b', owed_amount: 7.5 },
      ]}),
    ], [settlement('b', 'a', 3), settlement('b', 'a', 2)], members)
    expect(net).toEqual({ a: 2.5, b: -2.5, c: 0 })
  })

  it('nets always sum to zero across a messy history', () => {
    const net = calcNetBalances(G, [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 3.34 },
        { group_member_id: 'b', owed_amount: 3.33 },
        { group_member_id: 'c', owed_amount: 3.33 },
      ]}),
      expense({ paid_by: 'b', splits: [
        { group_member_id: 'b', owed_amount: 20.01 },
        { group_member_id: 'c', owed_amount: 19.99 },
      ]}),
      expense({ paid_by: 'c', splits: [
        { group_member_id: 'a', owed_amount: 0.01 },
        { group_member_id: 'c', owed_amount: 0.02 },
      ]}),
    ], [settlement('c', 'b', 5.55)], members)
    expect(netSum(net)).toBe(0)
  })

  it('counts members with no activity as zero', () => {
    const net = calcNetBalances(G, [], [], members)
    expect(net).toEqual({ a: 0, b: 0, c: 0 })
  })
})

describe('simplifyDebts', () => {
  it('returns [] when everyone is settled', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([])
  })

  it('collapses a 3-person chain into minimal transfers', () => {
    // a is owed 20, b owes 10, c owes 10 → exactly 2 transfers, both to a
    const transfers = simplifyDebts({ a: 20, b: -10, c: -10 })
    expect(transfers).toHaveLength(2)
    expect(transfers.every(t => t.to === 'a')).toBe(true)
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(20)
  })

  it('extinguishes all debts exactly', () => {
    const net = { a: 33.34, b: -3.33, c: -30.01 }
    const transfers = simplifyDebts(net)
    const after = { ...net }
    transfers.forEach(t => {
      after[t.from as keyof typeof after] += t.amount
      after[t.to as keyof typeof after] -= t.amount
    })
    Object.values(after).forEach(v => expect(Math.abs(v)).toBeLessThan(0.01))
  })

  it('treats sub-cent residue as settled (epsilon)', () => {
    expect(simplifyDebts({ a: 0.005, b: -0.005 })).toEqual([])
  })

  it('never emits a transfer larger than the biggest debt', () => {
    const transfers = simplifyDebts({ a: 50, b: 25, c: -40, d: -35 })
    transfers.forEach(t => expect(t.amount).toBeLessThanOrEqual(50))
    expect(transfers.length).toBeLessThanOrEqual(3) // n-1 transfers max for 4 people
  })
})

// Pairwise nets from one member's perspective: positive = they owe me,
// negative = I owe them. Inputs are already group-scoped (same as the
// per-group query caches), so no groupId parameter.
describe('calcPairwiseNets', () => {
  it('credits me per person for splits on expenses I paid', () => {
    const pair = calcPairwiseNets('a', [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 10 },
        { group_member_id: 'b', owed_amount: 10 },
        { group_member_id: 'c', owed_amount: 10 },
      ]}),
    ], [])
    expect(pair).toEqual({ b: 10, c: 10 })
  })

  it('debits me by my split when someone else paid', () => {
    const pair = calcPairwiseNets('a', [
      expense({ paid_by: 'b', splits: [
        { group_member_id: 'a', owed_amount: 12.5 },
        { group_member_id: 'b', owed_amount: 12.5 },
      ]}),
    ], [])
    expect(pair).toEqual({ b: -12.5 })
  })

  it('is unaffected by expenses I am not part of', () => {
    const pair = calcPairwiseNets('a', [
      expense({ paid_by: 'b', splits: [
        { group_member_id: 'b', owed_amount: 8 },
        { group_member_id: 'c', owed_amount: 8 },
      ]}),
    ], [])
    expect(pair.b ?? 0).toBe(0)
    expect(pair.c ?? 0).toBe(0)
  })

  it('excludes soft-deleted expenses', () => {
    const pair = calcPairwiseNets('a', [
      expense({
        paid_by: 'a',
        deleted_at: '2026-07-01T00:00:00Z',
        splits: [
          { group_member_id: 'a', owed_amount: 50 },
          { group_member_id: 'b', owed_amount: 50 },
        ],
      }),
    ], [])
    expect(pair.b ?? 0).toBe(0)
  })

  it('applies settlements in both directions', () => {
    const pair = calcPairwiseNets('a', [
      expense({ paid_by: 'b', splits: [
        { group_member_id: 'a', owed_amount: 20 },
        { group_member_id: 'b', owed_amount: 20 },
      ]}),
    ], [
      settlement('a', 'b', 5), // I paid b $5 → my debt shrinks
      settlement('b', 'a', 2), // b paid me $2 → my debt grows back
    ])
    expect(pair).toEqual({ b: -17 })
  })

  it('rounds accumulated float error to cents', () => {
    const pair = calcPairwiseNets('a', [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 0.1 },
        { group_member_id: 'b', owed_amount: 0.1 },
      ]}),
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 0.2 },
        { group_member_id: 'b', owed_amount: 0.2 },
      ]}),
    ], [])
    expect(pair.b).toBe(0.3) // not 0.30000000000000004
  })
})

describe('summarizeBalances', () => {
  it('splits pairwise nets into gross owedToMe / iOwe and net', () => {
    expect(summarizeBalances({ b: 10, c: -4, d: 2.5 }))
      .toEqual({ owedToMe: 12.5, iOwe: 4, net: 8.5 })
  })

  it('returns zeros for empty input', () => {
    expect(summarizeBalances({})).toEqual({ owedToMe: 0, iOwe: 0, net: 0 })
  })

  it('treats sub-cent residue as settled (epsilon)', () => {
    expect(summarizeBalances({ b: 0.005, c: -0.004 }))
      .toEqual({ owedToMe: 0, iOwe: 0, net: 0 })
  })

  it('rounds gross sums to cents', () => {
    const { owedToMe } = summarizeBalances({ b: 0.1, c: 0.2 })
    expect(owedToMe).toBe(0.3)
  })

  it('does not floor gross at zero when settlements overshoot', () => {
    // Someone overpays me: pairwise flips negative. The old hero math
    // clamped this with Math.max(0); the summary must report it as iOwe
    // so the hero always equals the sum of the person rows.
    expect(summarizeBalances({ b: -3 }))
      .toEqual({ owedToMe: 0, iOwe: 3, net: -3 })
  })
})

// The invariant that makes the dashboard fold trustworthy: summing my
// pairwise nets must equal my row in the full group net calculation.
describe('pairwise ↔ net consistency', () => {
  it('summarize(calcPairwiseNets(me)).net === calcNetBalances(...)[me] for every member', () => {
    const members = ['a', 'b', 'c', 'd']
    const expenses = [
      expense({ paid_by: 'a', splits: [
        { group_member_id: 'a', owed_amount: 3.34 },
        { group_member_id: 'b', owed_amount: 3.33 },
        { group_member_id: 'c', owed_amount: 3.33 },
      ]}),
      expense({ paid_by: 'b', splits: [
        { group_member_id: 'b', owed_amount: 20.01 },
        { group_member_id: 'c', owed_amount: 19.99 },
      ]}),
      expense({ paid_by: 'c', splits: [
        { group_member_id: 'a', owed_amount: 0.01 },
        { group_member_id: 'c', owed_amount: 0.02 },
      ]}),
      expense({
        paid_by: 'd',
        deleted_at: '2026-07-01T00:00:00Z',
        splits: [
          { group_member_id: 'd', owed_amount: 40 },
          { group_member_id: 'a', owed_amount: 40 },
        ],
      }),
    ]
    const settlements = [
      settlement('c', 'b', 5.55),
      settlement('b', 'a', 3.33),
      settlement('a', 'c', 10), // overshoot — a ends up owed by c
    ]

    const net = calcNetBalances(G, expenses, settlements, members)
    for (const me of members) {
      const { net: pairNet } = summarizeBalances(calcPairwiseNets(me, expenses, settlements))
      expect(pairNet, `member ${me}`).toBe(net[me])
    }
  })
})