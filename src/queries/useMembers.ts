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

      // Sequential and checked. These ran as an unchecked Promise.all, which
      // fails open in the one direction that can't be recovered from the UI:
      // if the membership UPDATE is rejected but the notification is still
      // marked read, the invite card disappears (useNotifications is
      // unread-only) while the seat stays 'pending' — the invitee never joined
      // and has no way left to accept.
      const { data: joined, error: joinError } = await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .select('id')
      if (joinError) throw joinError
      // Zero rows matched: the seat wasn't pending (already accepted, removed,
      // or converted to a guest). Not an error from PostgREST's side, but the
      // invite was not accepted, so it must not be retired as if it had been.
      if (!joined?.length) throw new Error('This invite is no longer available.')

      const { error: readError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
      if (readError) throw readError
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
      // Sequential for the same reason as accept: postJson throws on a failed
      // decline, but under Promise.all the read-marking has already been sent
      // and lands anyway, retiring the card for a decline that didn't happen.
      await postJson('/api/invite/decline', { groupId })

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
      if (error) throw error
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
      const { data: myGroups, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      // Throw rather than return []: TanStack can show an error state and
      // retry, whereas an empty array is indistinguishable from "you haven't
      // shared a group with anyone yet" and just renders as no suggestions.
      if (groupsError) throw groupsError

      if (!myGroups?.length) return []

      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, profile:profiles(id, name, display_name, avatar_url, add_code)')
        .in('group_id', myGroups.map(g => g.group_id))
        .neq('user_id', user.id)
        // Exclude pending members — they haven't consented to being in the group yet
        .eq('status', 'active')
      if (error) throw error

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

