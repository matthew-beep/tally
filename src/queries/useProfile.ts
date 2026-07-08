'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient, getAuthUser } from '@/lib/supabase'
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
    queryFn: async () => {
      const user = await getAuthUser(supabase)
      // Unread only — the bell badge and notification list both show unread items.
      // This query uses refetchOnMount (standard default); the unread count badge
      // uses refetchInterval: 30_000 in its own query (not defined here).
      const { data, error } = await supabase
        .from('notifications')
        // FK hints required: notifications has both settlement_id and group_id FKs,
        // settlements has two FKs to group_members, and group_members has two FKs
        // to profiles (user_id + invited_by).
        .select('*, settlement:settlements(*, from_member:group_members!from_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(*)), to_member:group_members!to_member_id(id, name, user_id, profile:profiles!group_members_user_id_fkey(*))), group:groups(id, name, emoji)')
        .eq('recipient_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Notification[]
    },
  })
}
