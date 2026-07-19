'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

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
    </QueryClientProvider>
  )
}
