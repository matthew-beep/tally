'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Expense } from '@/types'

// Shared by useExpenses (single group) and useAllGroupData (fan-out) so
// both read and write the same ['expenses', groupId] cache entry.
export function expensesQueryOptions(groupId: string) {
  const supabase = createClient()
  return {
    queryKey: ['expenses', groupId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, splits:expense_splits(id, group_member_id, owed_amount), payer:group_members!paid_by(id, name, user_id, profile:profiles!group_members_user_id_fkey(avatar_url, display_name))')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Expense[]
    },
    enabled: !!groupId,
  }
}

export function useExpenses(groupId: string) {
  return useQuery(expensesQueryOptions(groupId))
}

export function useDeleteExpense(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', expenseId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] })
    },
  })
}

export interface ExpenseEdit {
  expenseId: string
  description: string
  amount: number
  paid_by: string
  split_type: Expense['split_type']
  splits: { group_member_id: string; owed_amount: number }[]
  category: string
  expense_date: string
}

// Full edit — the expense row and its splits replaced in one transaction by
// update_expense_with_splits, so a failure can never leave an expense with no
// splits. Split sum invariant: caller (lib/splits.ts) balances the splits; the
// RPC re-checks and rejects anything that doesn't sum to the amount.
export function useUpdateExpense(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (edit: ExpenseEdit) => {
      const { error } = await supabase.rpc('update_expense_with_splits', {
        p_expense_id:   edit.expenseId,
        p_description:  edit.description.trim(),
        p_amount:       Math.round(edit.amount * 100) / 100,
        p_paid_by:      edit.paid_by,
        p_split_type:   edit.split_type,
        p_category:     edit.category,
        p_expense_date: edit.expense_date,
        p_splits:       edit.splits.map(s => ({ group_member_id: s.group_member_id, owed_amount: Number(s.owed_amount) })),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', groupId] })
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
    },
  })
}

export function useAddExpense(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      description: string
      amount: number
      paid_by: string
      split_type: 'equal' | 'percentage' | 'exact'
      splits: { group_member_id: string; owed_amount: number }[]
      category: string
      expense_date: string
    }) => {
      const { splits: splitData, ...expenseData } = payload
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({ ...expenseData, group_id: groupId })
        .select()
        .single()
      if (error) throw error

      // Split sum invariant: caller (lib/splits.ts) must ensure amounts sum to
      // expense total before this point — not re-validated here.
      const splitsToInsert = splitData.map(s => ({
        expense_id: expense.id,
        group_member_id: s.group_member_id,
        owed_amount: s.owed_amount,
      }))
      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert)
      if (splitsError) throw splitsError

      return expense as Expense
    },
    onSuccess: () => {
      // Per-group keys only: home/activity aggregates derive from these
      // caches, so they recompute without their own invalidation.
      qc.invalidateQueries({ queryKey: ['expenses', groupId] })
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
    },
  })
}
