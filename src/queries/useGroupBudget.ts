'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BudgetVersion } from '@/lib/budget'

interface BudgetRow {
  starts_month: string
  monthly_cap: number | string | null
  limits: { category: string; amount: number | string }[] | null
}

/** Every budget a group has had, oldest first. An empty list means it's never had one. */
export function useGroupBudget(groupId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['budget', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_budgets')
        .select('starts_month, monthly_cap, limits:group_budget_limits(category, amount)')
        .eq('group_id', groupId)
        .order('starts_month')
      if (error) throw error
      return ((data ?? []) as BudgetRow[]).map((row): BudgetVersion => ({
        month: row.starts_month.slice(0, 7),
        // Postgres numerics can arrive as strings.
        cap: row.monthly_cap == null ? null : Number(row.monthly_cap),
        limits: Object.fromEntries((row.limits ?? []).map(l => [l.category, Number(l.amount)])),
      }))
    },
    enabled: !!groupId,
  })
}

/** Saving with no total and no limits removes the budget from `month` on. */
export function useSaveGroupBudget(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, cap, limits }: { month: string; cap: number | null; limits: Record<string, number> }) => {
      const { error } = await supabase.rpc('save_group_budget', {
        p_group_id: groupId,
        p_starts_month: `${month}-01`,
        p_monthly_cap: cap,
        p_limits: limits,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget', groupId] }),
  })
}
