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
        .select('*, splits:expense_splits(*), payer:profiles!paid_by(*)')
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

export function useAddExpense(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      description: string
      amount: number
      paid_by: string
      split_type: 'equal' | 'exact'
      splits: { user_id: string; owed_amount: number }[]
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

      const splitsToInsert = splitData.map(s => ({
        expense_id: expense.id,
        user_id: s.user_id,
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
    },
  })
}
