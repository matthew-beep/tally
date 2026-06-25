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

export function useDeleteGroup() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: (_, groupId) => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['global-balances'] })
      qc.invalidateQueries({ queryKey: ['recent-activity'] })
      qc.removeQueries({ queryKey: ['groups', groupId] })
      qc.removeQueries({ queryKey: ['group_members', groupId] })
      qc.removeQueries({ queryKey: ['expenses', groupId] })
      qc.removeQueries({ queryKey: ['settlements', groupId] })
    },
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, emoji, creatorName, members }: {
      name: string
      emoji: string
      creatorName: string
      members: { type: 'user'; profileId: string; name: string }[] | { type: 'guest'; name: string }[]
    }) => {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji, creatorName, members }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create group')
      return res.json() as Promise<{ id: string; membersError: string | null }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['global-balances'] })
    },
  })
}
