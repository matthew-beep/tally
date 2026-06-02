'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import type { ProfileSnippet } from '@/queries/useProfile'

export function useAddGroupMember(groupId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const user = await getAuthUser(supabase)
      // Upsert prevents duplicate pending rows — PK on (group_id, user_id) is the guard.
      const { error } = await supabase
        .from('group_members')
        .upsert({ group_id: groupId, user_id: profileId, status: 'pending', invited_by: user.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
    },
  })
}

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
      qc.invalidateQueries({ queryKey: ['global-balances'] })
    },
  })
}

export function useDeclineGroupInvite() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, notificationId }: { groupId: string; notificationId: string }) => {
      const user = await getAuthUser(supabase)
      await Promise.all([
        // DELETE fires notify_group_invite_declined trigger automatically.
        // The full guest-profile conversion + expense_splits transfer happens in
        // POST /api/invite/decline (needs service role to bypass RLS on splits).
        supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .eq('status', 'pending'),
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
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

// Standalone (non-hook) version used during group creation where there's no
// React component to call a hook from. Fetches its own session to keep the
// public API at two args — callers don't need to thread invited_by through.
export async function addMembersToGroup(groupId: string, profileIds: string[]) {
  if (!profileIds.length) return
  const supabase = createClient()
  const user = await getAuthUser(supabase)
  const rows = profileIds.map(user_id => ({
    group_id: groupId,
    user_id,
    status: 'pending',
    invited_by: user.id,
  }))
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
