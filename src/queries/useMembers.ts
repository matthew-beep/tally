'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { ProfileSnippet } from '@/queries/useProfile'

export function useAddGroupMember(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('group_members')
        .upsert({ group_id: groupId, user_id: profileId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
    },
  })
}

export function useRecentCollaborators() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['recents'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return []

      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id)

      if (!myGroups?.length) return []

      const { data } = await supabase
        .from('group_members')
        .select('user_id, profile:profiles(id, name, display_name, avatar_url, add_code)')
        .in('group_id', myGroups.map(g => g.group_id))
        .neq('user_id', session.user.id)

      const seen = new Set<string>()
      const result: ProfileSnippet[] = []
      for (const row of data ?? []) {
        const p = (row as any).profile as ProfileSnippet
        if (!p || seen.has(p.id)) continue
        seen.add(p.id)
        result.push(p)
      }
      return result.slice(0, 8)
    },
  })
}

export async function addMembersToGroup(groupId: string, profileIds: string[]) {
  if (!profileIds.length) return
  const supabase = createClient()
  const rows = profileIds.map(user_id => ({ group_id: groupId, user_id }))
  const { error } = await supabase.from('group_members').upsert(rows)
  if (error) throw error
}

export async function createGuestProfile(name: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .insert({ name, status: 'guest' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
