'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import { postJson } from '@/lib/api'
import type { Group, GroupMember } from '@/types'

// Shared by useGroups and useMyGroupIds (an ids view via select) — the one
// ['groups'] cache entry is the root of the cross-group dependency tree.
// Any mutation that changes membership must invalidate ['groups'].
export function groupsQueryOptions() {
  const supabase = createClient()
  return {
    queryKey: ['groups'] as const,
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
  }
}

export function useGroups() {
  return useQuery(groupsQueryOptions())
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

// Shared by useGroupMembers (single group) and useAllGroupData (fan-out) so
// both read and write the same ['group_members', groupId] cache entry.
export function groupMembersQueryOptions(groupId: string) {
  const supabase = createClient()
  return {
    queryKey: ['group_members', groupId] as const,
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
      return (data ?? []) as GroupMember[]
    },
    enabled: !!groupId,
  }
}

export function useGroupMembers(groupId: string) {
  return useQuery(groupMembersQueryOptions(groupId))
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
      members: ({ type: 'user'; profileId: string; name: string } | { type: 'guest'; name: string })[]
    }) => {
      return postJson<{ id: string; membersError: string | null }>(
        '/api/groups/create',
        { name, emoji, creatorName, members },
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}
