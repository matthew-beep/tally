'use client'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ToastStack } from '@/components/Toast'
import { useUIStore } from '@/store/ui'

// PostgrestError is a plain object, not an Error instance — so `throw error`
// straight off a Supabase result (the pattern used throughout src/queries)
// would otherwise always fall through to the generic message and hide what
// actually went wrong. Read `.message` off anything that carries one.
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const m = (error as { message: unknown }).message
    if (typeof m === 'string' && m.length > 0) return m
  }
  return 'Something went wrong. Try again.'
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
          },
        },
        // Global net: fires for every mutation failure regardless of any
        // mutation-local onError, so a failed save always surfaces something
        // instead of silently leaving the UI in a "did that work?" state.
        mutationCache: new MutationCache({
          onError: error => {
            useUIStore.getState().pushToast(errorMessage(error))
          },
        }),
      })
  )

  // Auth boundary = cache boundary: a different user (or no user) must never
  // be served the previous user's cached data. Compare user ids rather than
  // reacting to event names — SIGNED_IN also fires on token refresh and tab
  // refocus, and clearing there would nuke the warm cache constantly.
  const lastUserId = useRef<string | null | undefined>(undefined) // undefined = not yet observed
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      if (lastUserId.current !== undefined && uid !== lastUserId.current) {
        queryClient.clear()
      }
      lastUserId.current = uid
    })
    return () => subscription.unsubscribe()
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastStack />
    </QueryClientProvider>
  )
}
