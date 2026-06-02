'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import type { Group } from '@/types'

export function useGroups() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', user.id)
        // Pending and left groups must not appear in the user's group list
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
      if (error) throw error
      return (data?.map(row => (row as any).groups).filter(Boolean) ?? []) as Group[]
    },
  })
}

export function useGroup(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['groups', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Group
    },
    enabled: !!id,
  })
}

export function useGroupMembers(groupId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['group_members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        // Include pending so the creator can split with members before they accept.
        // Pending = visibility/consent gate, not a block on expense creation.
        .select('*, profile:profiles!group_members_user_id_fkey(*)')
        // FK hint required: group_members has two FKs to profiles (user_id + invited_by)
        // and PostgREST can't infer which to follow without it.
        .eq('group_id', groupId)
        .in('status', ['pending', 'active'])
      if (error) throw error
      return data ?? []
    },
    enabled: !!groupId,
  })
}

export function useProfileGroups(profileId: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profile_groups', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', profileId!)
        .eq('status', 'active')
      if (error) throw error
      return (data?.map(r => r.group_id) ?? []) as string[]
    },
    enabled: !!profileId,
  })
}

export function useCreateGroup() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, emoji }: { name: string; emoji: string }) => {
      const user = await getAuthUser(supabase)

      const { data: group, error } = await supabase
        .from('groups')
        .insert({ name, emoji, created_by: user.id })
        .select()
        .single()
      if (error) throw error

      // Creator must be active immediately — without this the DB default lands
      // them as pending, which would lock them out of their own group.
      await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, status: 'active' })

      return group as Group
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['global-balances'] })
    },
  })
}
