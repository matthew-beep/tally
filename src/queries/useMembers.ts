'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import { postJson } from '@/lib/api'
import type { ProfileSnippet } from '@/queries/useProfile'

export function useAcceptGroupInvite() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, notificationId }: { groupId: string; notificationId: string }) => {
      const user = await getAuthUser(supabase)
      await Promise.all([
        supabase
          .from('group_members')
          .update({ status: 'active' })
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .eq('status', 'pending'),
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId),
      ])
      // UPDATE pending→active fires notify_group_invite_accepted trigger,
      // which notifies invited_by — no manual notification write needed here.
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
    },
  })
}

export function useDeclineGroupInvite() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, notificationId }: { groupId: string; notificationId: string }) => {
      // The route decides: no financial history → DELETE the pending row
      // (fires notify_group_invite_declined); already in splits → convert the
      // seat to a guest so history survives. Never DELETE directly here —
      // expense_splits cascade on member delete and balances would corrupt.
      await Promise.all([
        postJson('/api/invite/decline', { groupId }),
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId),
      ])
    },
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
    },
  })
}

export function useRecentCollaborators() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['recents'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)

      // Two-step: first get the user's groups, then fetch co-members.
      // A single join would pull all group data unnecessarily.
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (!myGroups?.length) return []

      const { data } = await supabase
        .from('group_members')
        .select('user_id, profile:profiles(id, name, display_name, avatar_url, add_code)')
        .in('group_id', myGroups.map(g => g.group_id))
        .neq('user_id', user.id)
        // Exclude pending members — they haven't consented to being in the group yet
        .eq('status', 'active')

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

