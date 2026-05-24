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

export function useSearchProfiles(query: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['profiles', 'search', query],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return []

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url')
        .or(`name.ilike.%${query}%,display_name.ilike.%${query}%,add_code.eq.${query.toUpperCase()}`)
        .eq('status', 'active')
        .neq('id', session.user.id)
        .limit(10)
      if (error) throw error
      return (data ?? []) as Pick<Profile, 'id' | 'name' | 'display_name' | 'avatar_url'>[]
    },
    enabled: query.length >= 2,
  })
}

export function useNotifications() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return []
      const { data, error } = await supabase
        .from('notifications')
        .select('*, settlement:settlements(*, from_profile:profiles!from_user(*), to_profile:profiles!to_user(*))')
        .eq('recipient_id', session.user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Notification[]
    },
  })
}
