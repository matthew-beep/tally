'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Profile, Notification } from '@/types'

export function useCurrentProfile() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

export type ProfileSnippet = Pick<Profile, 'id' | 'name' | 'display_name' | 'avatar_url' | 'add_code' | 'handle'>

export function useSearchProfiles(query: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profiles', 'search', query],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return []

      // Single .or() covers name fuzzy, display_name fuzzy, and exact add_code match.
      // Email is included for search but never returned to the client (select omits it).
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url, add_code, handle')
        .or(`name.ilike.%${query}%,display_name.ilike.%${query}%,email.ilike.%${query}%,add_code.eq.${query.toUpperCase()}`)
        .eq('status', 'active')
        .neq('id', session.user.id)
        .limit(10)
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return []
      // Unread only — the bell badge and notification list both show unread items.
      // This query uses refetchOnMount (standard default); the unread count badge
      // uses refetchInterval: 30_000 in its own query (not defined here).
      const { data, error } = await supabase
        .from('notifications')
        // FK hints required: notifications has both settlement_id and group_id FKs,
        // and settlements itself has two FKs to profiles.
        .select('*, settlement:settlements(*, from_profile:profiles!from_user(*), to_profile:profiles!to_user(*)), group:groups(id, name, emoji)')
        .eq('recipient_id', session.user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Notification[]
    },
  })
}
