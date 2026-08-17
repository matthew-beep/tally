'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { ExpenseComment } from '@/types'

// Own key, fetched lazily by the detail drawer — not joined into
// expensesQueryOptions, which useAllGroupData fans out across every group for
// the dashboard. Comment bodies would bloat that fetch for a screen that
// never renders them. See docs/social-and-leaderboard-design.md#fetching.
export function expenseCommentsQueryOptions(expenseId: string) {
  const supabase = createClient()
  return {
    queryKey: ['expense-comments', expenseId] as const,
    queryFn: async (): Promise<ExpenseComment[]> => {
      const { data, error } = await supabase
        .from('expense_comments')
        .select('id, expense_id, group_id, group_member_id, body, created_at, deleted_at')
        .eq('expense_id', expenseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!expenseId,
  }
}

export function useExpenseComments(expenseId: string) {
  return useQuery(expenseCommentsQueryOptions(expenseId))
}

/**
 * Post a comment, optimistically.
 *
 * Unlike a reaction toggle, the guess here can't reproduce the real row: `id`
 * and `created_at` are server-assigned. The optimistic row uses a temporary
 * id (filtered out of anything keyed by it) and `Date.now()` for ordering, and
 * onSettled always refetches so the temp row is replaced by the server's,
 * rather than trusted long-term.
 */
export function useAddComment(expenseId: string, groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  const key = expenseCommentsQueryOptions(expenseId).queryKey

  return useMutation({
    mutationFn: async ({ body, seatId }: { body: string; seatId: string }) => {
      const { error } = await supabase
        .from('expense_comments')
        .insert({ expense_id: expenseId, group_id: groupId, group_member_id: seatId, body })
      if (error) throw error
    },

    onMutate: async ({ body, seatId }: { body: string; seatId: string }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ExpenseComment[]>(key)
      const optimistic: ExpenseComment = {
        id: `optimistic-${Date.now()}`,
        expense_id: expenseId,
        group_id: groupId,
        group_member_id: seatId,
        body,
        created_at: new Date().toISOString(),
        deleted_at: null,
      }
      qc.setQueryData<ExpenseComment[]>(key, old => [...(old ?? []), optimistic])
      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

/** Soft-delete your own comment. Author-only — RLS rejects anyone else's attempt. */
export function useDeleteComment(expenseId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  const key = expenseCommentsQueryOptions(expenseId).queryKey

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('expense_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)
      if (error) throw error
    },

    onMutate: async (commentId: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ExpenseComment[]>(key)
      qc.setQueryData<ExpenseComment[]>(key, old => (old ?? []).filter(c => c.id !== commentId))
      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}
