import { createBrowserClient } from '@supabase/ssr'
import { processLock } from '@supabase/auth-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Default uses the browser's navigator.locks API to serialize session
        // refreshes across tabs. WebKit has a bug where a lock held by a page
        // that gets navigated away mid-request (e.g. our OAuth redirect chain
        // through /auth/callback) never releases — every future getSession()/
        // getUser() call then hangs forever, in every tab, until Safari is
        // fully quit. processLock is an in-memory mutex scoped to this page
        // instead of the OS-level Web Locks API, so it can't get orphaned like
        // that. Tradeoff: session refresh is no longer coordinated across tabs,
        // which is fine — Tally doesn't rely on multi-tab realtime sync.
        lock: processLock,
      },
    }
  )
}

export async function getAuthUser(supabase: SupabaseClient) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')
  return session.user
}
