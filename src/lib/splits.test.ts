import { describe, it, expect } from 'vitest'
import { makeEqualSplits, makePercentSplits, makeExactSplits, rescaleSplits } from './splits'

const sum = (splits: { owed_amount: number }[]) =>
  Math.round(splits.reduce((a, s) => a + s.owed_amount, 0) * 100) / 100

describe('makeEqualSplits', () => {
  it('splits $10 three ways and sums exactly to the total', () => {
    const splits = makeEqualSplits('e1', 10, ['a', 'b', 'c'])
    expect(sum(splits)).toBe(10)
    expect(splits.map(s => s.owed_amount)).toEqual([3.34, 3.33, 3.33])
  })

  it('assigns the rounding remainder to the first member (the payer)', () => {
    const splits = makeEqualSplits('e1', 100, ['payer', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(sum(splits)).toBe(100)
    const [first, ...rest] = splits
    expect(rest.every(s => s.owed_amount === rest[0].owed_amount)).toBe(true)
    expect(first.owed_amount).toBeGreaterThanOrEqual(rest[0].owed_amount)
    expect(first.group_member_id).toBe('payer')
  })

  it('handles amounts smaller than one cent per person', () => {
    const splits = makeEqualSplits('e1', 0.01, ['a', 'b'])
    expect(sum(splits)).toBe(0.01)
    expect(splits.map(s => s.owed_amount)).toEqual([0.01, 0])
  })

  it('splits evenly with no remainder when it divides cleanly', () => {
    const splits = makeEqualSplits('e1', 30, ['a', 'b', 'c'])
    expect(splits.map(s => s.owed_amount)).toEqual([10, 10, 10])
  })

  it('returns [] for no members', () => {
    expect(makeEqualSplits('e1', 10, [])).toEqual([])
  })

  it('never produces negative or NaN amounts', () => {
    for (const amount of [0.01, 0.05, 1, 9.99, 33.33, 100.01]) {
      for (const n of [1, 2, 3, 4, 5, 6, 7]) {
        const splits = makeEqualSplits('e1', amount, Array.from({ length: n }, (_, i) => `m${i}`))
        expect(sum(splits)).toBe(amount)
        splits.forEach(s => {
          expect(Number.isFinite(s.owed_amount)).toBe(true)
          expect(s.owed_amount).toBeGreaterThanOrEqual(0)
        })
      }
    }
  })
})

describe('makePercentSplits', () => {
  it('splits by percentage and sums exactly to the total', () => {
    const splits = makePercentSplits('e1', 100, [
      { group_member_id: 'a', percent: 33 },
      { group_member_id: 'b', percent: 33 },
      { group_member_id: 'c', percent: 34 },
    ])
    expect(sum(splits)).toBe(100)
    expect(splits.map(s => s.owed_amount)).toEqual([33, 33, 34])
  })

  it('folds the rounding diff into the first row when thirds do not round cleanly', () => {
    const splits = makePercentSplits('e1', 10, [
      { group_member_id: 'a', percent: 33.33 },
      { group_member_id: 'b', percent: 33.33 },
      { group_member_id: 'c', percent: 33.34 },
    ])
    expect(sum(splits)).toBe(10)
  })

  it('handles a 100% single-member split', () => {
    const splits = makePercentSplits('e1', 42.42, [{ group_member_id: 'a', percent: 100 }])
    expect(splits).toHaveLength(1)
    expect(splits[0].owed_amount).toBe(42.42)
  })

  it('returns [] for no entries', () => {
    expect(makePercentSplits('e1', 10, [])).toEqual([])
  })
})

describe('makeExactSplits', () => {
  it('rounds each amount to cents', () => {
    const splits = makeExactSplits('e1', [
      { group_member_id: 'a', owed_amount: 3.333 },
      { group_member_id: 'b', owed_amount: 6.667 },
    ])
    expect(splits.map(s => s.owed_amount)).toEqual([3.33, 6.67])
  })

  it('tags every row with the expense id', () => {
    const splits = makeExactSplits('e1', [{ group_member_id: 'a', owed_amount: 5 }])
    expect(splits[0].expense_id).toBe('e1')
  })
})

describe('rescaleSplits', () => {
  it('scales down proportionally and keeps the sum exact', () => {
    const splits = rescaleSplits(
      [
        { group_member_id: 'payer', owed_amount: 10 },
        { group_member_id: 'b', owed_amount: 10 },
        { group_member_id: 'c', owed_amount: 10 },
      ],
      20,
      'payer'
    )
    expect(sum(splits)).toBe(20)
    // 20/3 = 6.67, 6.67, 6.67 → sum 20.01, so payer absorbs the -0.01
    expect(splits.find(s => s.group_member_id === 'payer')!.owed_amount).toBe(6.66)
    expect(splits.find(s => s.group_member_id === 'b')!.owed_amount).toBe(6.67)
  })

  it('scales up proportionally', () => {
    const splits = rescaleSplits(
      [
        { group_member_id: 'a', owed_amount: 5 },
        { group_member_id: 'b', owed_amount: 15 },
      ],
      40,
      'a'
    )
    expect(splits.map(s => s.owed_amount)).toEqual([10, 30])
  })

  it('gives the remainder to the payer row, not the first row', () => {
    const splits = rescaleSplits(
      [
        { group_member_id: 'a', owed_amount: 10 },
        { group_member_id: 'b', owed_amount: 10 },
        { group_member_id: 'payer', owed_amount: 10 },
      ],
      10,
      'payer'
    )
    expect(sum(splits)).toBe(10)
    expect(splits.find(s => s.group_member_id === 'a')!.owed_amount).toBe(3.33)
    expect(splits.find(s => s.group_member_id === 'b')!.owed_amount).toBe(3.33)
    expect(splits.find(s => s.group_member_id === 'payer')!.owed_amount).toBe(3.34)
  })

  it('preserves unequal proportions', () => {
    const splits = rescaleSplits(
      [
        { group_member_id: 'a', owed_amount: 75 },
        { group_member_id: 'b', owed_amount: 25 },
      ],
      50,
      'a'
    )
    expect(splits.map(s => s.owed_amount)).toEqual([37.5, 12.5])
  })
})
