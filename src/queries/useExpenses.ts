'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { rescaleSplits } from '@/lib/splits'
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

// Amount/description/paid_by only — split membership stays fixed (no UI to
// change it yet). Existing owed_amount values are rescaled proportionally to
// the new amount, preserving split_type/shape. Rounding remainder goes to
// paid_by, per convention. paid_by must already own a split row; the caller
// is responsible for keeping the payer picker scoped to existing members
// until reassigning splits on payer change is supported.
export function useUpdateExpense(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ expense, description, amount, paid_by }: {
      expense: Expense
      description: string
      amount: number
      paid_by: string
    }) => {
      const roundedAmount = Math.round(amount * 100) / 100
      const oldSplits = expense.splits ?? []
      if (oldSplits.length === 0) throw new Error('Expense has no splits to rescale')
      if (!oldSplits.some(s => s.group_member_id === paid_by)) {
        throw new Error('New payer must already be part of the split')
      }

      const rescaled = rescaleSplits(oldSplits, roundedAmount, paid_by)

      // Update first: if this fails (e.g. amount <= 0), splits are untouched.
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ description: description.trim(), amount: roundedAmount, paid_by })
        .eq('id', expense.id)
      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expense.id)
      if (deleteError) throw deleteError

      const { error: insertError } = await supabase
        .from('expense_splits')
        .insert(rescaled.map(s => ({
          expense_id: expense.id,
          group_member_id: s.group_member_id,
          owed_amount: s.owed_amount,
        })))
      if (insertError) throw insertError
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
