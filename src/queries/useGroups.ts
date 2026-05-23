'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Group } from '@/types'

export function useGroups() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return []
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (!profile) return []
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', profile.id)
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
        .select('*, profile:profiles(*)')
        .eq('group_id', groupId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!groupId,
  })
}

export function useCreateGroup() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, emoji }: { name: string; emoji: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (!profile) throw new Error('Profile not found')

      const { data: group, error } = await supabase
        .from('groups')
        .insert({ name, emoji, created_by: profile.id })
        .select()
        .single()
      if (error) throw error

      await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: profile.id })

      return group as Group
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}
