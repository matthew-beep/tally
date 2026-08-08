import { describe, it, expect } from 'vitest'
import { calcLeaderboard } from './leaderboard'
import type { Expense } from '@/types'

const G = 'group-1'

function expense(paid_by: string, amount: number, over: Partial<Expense> = {}): Expense {
  return {
    id: 'e-' + Math.random().toString(36).slice(2),
    group_id: G,
    paid_by,
    amount,
    description: 'test',
    deleted_at: null,
    ...over,
  } as Expense
}

describe('calcLeaderboard', () => {
  const members = ['a', 'b', 'c']

  it('ranks by gross fronted, descending', () => {
    const board = calcLeaderboard(G, [
      expense('a', 30),
      expense('b', 100),
      expense('c', 60),
    ], members)
    expect(board.map(e => e.memberId)).toEqual(['b', 'c', 'a'])
    expect(board.map(e => e.paid)).toEqual([100, 60, 30])
  })

  it('sums multiple expenses per payer and counts them', () => {
    const board = calcLeaderboard(G, [
      expense('a', 30),
      expense('a', 45),
      expense('b', 50),
    ], members)
    expect(board[0]).toEqual({ memberId: 'a', paid: 75, txns: 2 })
    expect(board[1]).toEqual({ memberId: 'b', paid: 50, txns: 1 })
  })

  it('includes seats that fronted nothing', () => {
    const board = calcLeaderboard(G, [expense('a', 30)], members)
    expect(board).toHaveLength(3)
    expect(board.filter(e => e.paid === 0).map(e => e.memberId)).toEqual(['b', 'c'])
    expect(board.every(e => e.txns >= 0)).toBe(true)
  })

  it('excludes soft-deleted expenses', () => {
    const board = calcLeaderboard(G, [
      expense('a', 30),
      expense('a', 500, { deleted_at: '2026-08-01T00:00:00Z' }),
    ], members)
    expect(board[0]).toEqual({ memberId: 'a', paid: 30, txns: 1 })
  })

  it('excludes expenses from other groups', () => {
    const board = calcLeaderboard(G, [
      expense('a', 30),
      expense('b', 999, { group_id: 'group-2' }),
    ], members)
    expect(board.find(e => e.memberId === 'b')).toEqual({ memberId: 'b', paid: 0, txns: 0 })
  })

  it('ignores an expense whose payer is not in the member list', () => {
    const board = calcLeaderboard(G, [
      expense('a', 30),
      expense('ghost', 999),
    ], members)
    expect(board).toHaveLength(3)
    expect(board.some(e => e.memberId === 'ghost')).toBe(false)
  })

  it('total fronted equals total group spend', () => {
    const expenses = [expense('a', 30), expense('b', 45.55), expense('c', 12.1), expense('a', 7.35)]
    const board = calcLeaderboard(G, expenses, members)
    const boardTotal = board.reduce((s, e) => s + e.paid, 0)
    const spend = expenses.reduce((s, e) => s + e.amount, 0)
    expect(Math.round(boardTotal * 100) / 100).toBe(Math.round(spend * 100) / 100)
  })

  it('rounds to cents', () => {
    const board = calcLeaderboard(G, [expense('a', 0.1), expense('a', 0.2)], members)
    expect(board[0].paid).toBe(0.3)
  })

  it('keeps member order on ties (stable sort)', () => {
    const board = calcLeaderboard(G, [expense('a', 50), expense('b', 50), expense('c', 50)], members)
    expect(board.map(e => e.memberId)).toEqual(['a', 'b', 'c'])
  })

  it('returns a zeroed board for a group with no expenses', () => {
    const board = calcLeaderboard(G, [], members)
    expect(board).toEqual([
      { memberId: 'a', paid: 0, txns: 0 },
      { memberId: 'b', paid: 0, txns: 0 },
      { memberId: 'c', paid: 0, txns: 0 },
    ])
  })
})
