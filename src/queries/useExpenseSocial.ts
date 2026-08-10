'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { groupReactions, toggleReaction, type ReactionsByExpense } from '@/lib/reactions'

// Reactions live on their own key rather than joining into
// expensesQueryOptions, because that cache is fanned out across every group by
// useAllGroupData to compute the dashboard's global balances. Widening it would
// make every dashboard load pay for social data it never renders.
//
// Group-scoped in one request: the denormalized group_id on expense_reactions
// makes this a single indexed lookup instead of a join through expenses.
export function expenseSocialQueryOptions(groupId: string) {
  const supabase = createClient()
  return {
    queryKey: ['expense-social', groupId] as const,
    queryFn: async (): Promise<ReactionsByExpense> => {
      const { data, error } = await supabase
        .from('expense_reactions')
        .select('expense_id, group_member_id, emoji, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return groupReactions(data ?? [])
    },
    enabled: !!groupId,
  }
}

export function useExpenseSocial(groupId: string) {
  return useQuery(expenseSocialQueryOptions(groupId))
}

export interface ToggleReactionVars {
  expenseId: string
  emoji: string
  /** The reacting member's seat — must be the caller's own, or RLS rejects it. */
  seatId: string
  /** Whether the seat currently holds this emoji. The caller knows: it renders the state. */
  active: boolean
}

/**
 * React / un-react, optimistically.
 *
 * A reaction has no financial consequence, which is what makes guessing safe
 * here where the expense mutations deliberately invalidate instead. The guess
 * is `toggleReaction` (pure, tested in lib/reactions.test.ts) and rollback is
 * the pre-mutation snapshot, not an inverse toggle.
 *
 * `active` comes from the caller rather than being read off the cache, because
 * onMutate has already rewritten the cache by the time mutationFn runs.
 *
 * group_id is sent by the client but cannot be forged: the INSERT policy
 * requires it to be a group the caller belongs to, and the composite FK
 * requires the (expense_id, group_id) pair to match a real expense.
 */
export function useToggleReaction(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  const key = ['expense-social', groupId] as const

  return useMutation({
    mutationFn: async ({ expenseId, emoji, seatId, active }: ToggleReactionVars) => {
      if (active) {
        const { error } = await supabase
          .from('expense_reactions')
          .delete()
          .eq('expense_id', expenseId)
          .eq('group_member_id', seatId)
          .eq('emoji', emoji)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('expense_reactions')
          .insert({ expense_id: expenseId, group_id: groupId, group_member_id: seatId, emoji })
        if (error) throw error
      }
    },

    onMutate: async ({ expenseId, emoji, seatId }: ToggleReactionVars) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ReactionsByExpense>(key)
      qc.setQueryData<ReactionsByExpense>(key, old => toggleReaction(old ?? {}, expenseId, emoji, seatId))
      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      // Restore the snapshot rather than inverting the toggle — an inverse
      // would also have to undo whatever else landed in between.
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
    },

    // Reconcile regardless of outcome: a rejected INSERT and a lost race look
    // the same from here, and both want the server's version.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}
