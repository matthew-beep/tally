'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Settlement } from '@/types'

// Shared by useSettlements (single group) and useAllGroupData (fan-out) so
// both read and write the same ['settlements', groupId] cache entry.
export function settlementsQueryOptions(groupId: string) {
  const supabase = createClient()
  return {
    queryKey: ['settlements', groupId] as const,
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
  }
}

export function useSettlements(groupId: string) {
  return useQuery(settlementsQueryOptions(groupId))
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
      direction: 'owe' | 'owed'
    }) => {
      const { direction, ...rest } = payload
      const { data, error } = await supabase
        .from('settlements')
        .insert({ ...rest, group_id: groupId, status: direction === 'owe' ? 'pending' : 'confirmed' })
        .select()
        .single()
      if (error) throw error
      return data as Settlement
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
    },
  })
}

export function useConfirmSettlement() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, groupId, notificationId }: { id: string; groupId: string; notificationId: string }) => {
      // Deny deletes the settlement outright, which cascades into notifications
      // (settlement_id REFERENCES settlements ON DELETE CASCADE) — no explicit
      // read-marking needed there. Confirm only updates status, so the row
      // survives and the original settlement_confirm notification must be
      // marked read explicitly, same pattern as useAcceptGroupInvite.
      await Promise.all([
        supabase.from('settlements').update({ status: 'confirmed' }).eq('id', id),
        supabase.from('notifications').update({ read: true }).eq('id', notificationId),
      ])
      return { id, groupId }
    },
    onSuccess: ({ groupId }) => {
      qc.invalidateQueries({ queryKey: ['settlements', groupId] })
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
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
