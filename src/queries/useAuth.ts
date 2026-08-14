'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async (redirect: string) => {
      const supabase   = createClient()
      const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (error) throw error
    },
  })
}

export function useSignInWithPassword() {
  const router = useRouter()
  return useMutation({
    mutationFn: async ({ email, password, redirect }: { email: string; password: string; redirect: string }) => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return redirect
    },
    onSuccess: redirect => {
      router.push(redirect)
      router.refresh()
    },
  })
}

export function useSignOut() {
  const router = useRouter()
  const qc     = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
    },
    onSuccess: () => {
      // Redundant with the auth-change listener in Providers — kept as
      // insurance so the explicit path never depends on it.
      qc.clear()
      router.push('/login')
    },
  })
}
