import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Supabase SSR requires a mutable response so it can write
  // refreshed session cookies back to the browser on every request.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write into the request first (needed by Supabase internals),
          // then rebuild the response so it carries the updated cookies.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the session with the Supabase server on every call.
  // Do NOT use getSession() here — it trusts the local JWT without re-validating.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublic = ['/login', '/invite', '/expense', '/auth'].some(p =>
    pathname.startsWith(p)
  )

  // Unauthenticated → send to login, preserving the intended destination.
  if (!user && !isPublic) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated but no handle → force onboarding.
  if (user && !isPublic && !pathname.startsWith('/onboarding')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .single()

    if (profile && !profile.handle) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // Always return the supabaseResponse — it carries any refreshed cookies.
  return supabaseResponse
}

export const config = {
  // Run on all routes except Next.js internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
