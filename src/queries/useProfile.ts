'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
import { groupNotifications } from '@/lib/notifications'
import type { Profile, Notification } from '@/types'

export function useCurrentProfile() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateProfile() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, updates }: {
      profileId: string
      updates: { display_name?: string; handle?: string }
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', 'me'] })
    },
  })
}

export function useMarkNotificationsRead() {
  const supabase = createClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', ids)
      if (error) throw error
    },
    // No invalidation on purpose: info rows stay visible for the rest of this
    // visit and drop off on the next refetch, instead of vanishing mid-read.
  })
}

export type ProfileSnippet = Pick<Profile, 'id' | 'name' | 'display_name' | 'avatar_url' | 'add_code' | 'handle'>

export function useSearchProfiles(query: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profiles', 'search', query],
    queryFn: async () => {
      const user = await getAuthUser(supabase)

      let q = supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url, add_code, handle')
        .eq('status', 'active')
        .neq('id', user.id)
        .limit(10)

      if (query.startsWith('@')) {
        // @prefix → fuzzy handle search
        q = q.ilike('handle', `%${query.slice(1)}%`)
      } else if (/^[a-z0-9]{8}$/i.test(query)) {
        // 8-char alphanumeric → exact add_code match (QR code destination)
        q = q.eq('add_code', query.toUpperCase())
      } else {
        // Anything else → name + display_name + handle fuzzy
        q = q.or(`name.ilike.%${query}%,display_name.ilike.%${query}%,handle.ilike.%${query}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ProfileSnippet[]
    },
    enabled: query.length >= 2,
    // Keep showing the previous match while the next keystroke's query is
    // in flight, instead of flashing an empty list between debounce ticks.
    placeholderData: keepPreviousData,
  })
}

export function useProfileByAddCode(code: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profiles', 'byCode', code],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url, add_code')
        .eq('add_code', code.toUpperCase())
        .single()
      return (data ?? null) as ProfileSnippet | null
    },
    enabled: code.length > 0,
  })
}

export function useNotifications() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['notifications'],
    // Unread only — the bell badge and notification list both show unread items.
    // Polls per CLAUDE.md's bell exception so the badge updates without
    // requiring navigation. Deliberately reused (not split into a separate
    // lightweight count query) for one source of truth between the badge and
    // the notification center's list — cheap either way: idx_notifications_recip
    // is a partial index on unread rows only, and every join hop below (settlement_id,
    // from_member_id/to_member_id, group_members.user_id) lands on a primary key on
    // the other side, so cost scales with one user's unread count, not table size.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const user = await getAuthUser(supabase)
      const { data, error } = await supabase
        .from('notifications')
        // FK hints required: notifications has both settlement_id and group_id FKs,
        // settlements has two FKs to group_members, and group_members has two FKs
        // to profiles (user_id + invited_by).
        //
        // group:groups(...) is nested under settlement, not just on the
        // notification row — notify_settlement_created() never stamps
        // notifications.group_id (only group_invite rows get one), so that
        // top-level join always resolves null for settlement types. The
        // settlement's own group_id (NOT NULL) is the only real source.
        .select('*, settlement:settlements(*, group:groups(id, name, emoji), from_member:group_members!from_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(*)), to_member:group_members!to_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(*))), group:groups(id, name, emoji)')
        .eq('recipient_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      // Grouped here rather than at each surface: /me, the home rail and the
      // notification center all need the same collapse, and confirm/deny have
      // to act on a whole payment (item 5 (d)). recipient_id is a profile id,
      // and profiles.id === auth.users.id for real users, so user.id is the
      // right key for working out which side of each settlement is mine.
      return groupNotifications((data ?? []) as Notification[], user.id)
    },
  })
}
