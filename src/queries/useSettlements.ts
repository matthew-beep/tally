'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Settlement } from '@/types'

export function useSettlements(groupId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['settlements', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*, from_member:group_members!from_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(avatar_url, display_name)), to_member:group_members!to_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(avatar_url, display_name))')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Settlement[]
    },
    enabled: !!groupId,
  })
}

export function useCreateSettlement(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      from_member_id: string
      to_member_id: string
      amount: number
      note?: string
      settled_date: string
    }) => {
      const { data, error } = await supabase
        .from('settlements')
        .insert({ ...payload, group_id: groupId, status: 'pending' })
        .select()
        .single()
      if (error) throw error
      return data as Settlement
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      qc.invalidateQueries({ queryKey: ['global-balances'] })
      qc.invalidateQueries({ queryKey: ['all-activity'] })
    },
  })
}

export function useConfirmSettlement() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      await supabase.from('settlements').update({ status: 'confirmed' }).eq('id', id)
      return { id, groupId }
    },
    onSuccess: ({ groupId }) => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      qc.invalidateQueries({ queryKey: ['global-balances'] })
      qc.invalidateQueries({ queryKey: ['all-activity'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDenySettlement() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      await supabase.from('settlements').delete().eq('id', id)
      return { id, groupId }
    },
    onSuccess: ({ groupId }) => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
      qc.invalidateQueries({ queryKey: ['global-balances'] })
      qc.invalidateQueries({ queryKey: ['all-activity'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
