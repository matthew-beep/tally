'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Expense } from '@/types'

export function useExpenses(groupId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['expenses', groupId],
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
  })
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
      qc.invalidateQueries({ queryKey: ['global-balances'] })
      qc.invalidateQueries({ queryKey: ['recent-activity'] })
      qc.invalidateQueries({ queryKey: ['all-activity'] })
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
      qc.invalidateQueries({ queryKey: ['expenses', groupId] })
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      // Invalidate home page aggregates so balance hero and activity feed
      // reflect the new expense immediately on navigation back.
      qc.invalidateQueries({ queryKey: ['global-balances'] })
      qc.invalidateQueries({ queryKey: ['recent-activity'] })
      qc.invalidateQueries({ queryKey: ['all-activity'] })
    },
  })
}
