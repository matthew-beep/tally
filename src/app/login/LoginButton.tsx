'use client'

import { T, F, FH } from '@/design/tokens'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.72v2.27h2.9c1.7-1.56 2.69-3.86 2.69-6.64z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.81 5.95-2.18l-2.9-2.27c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: T.r.md,
  border: `1.5px solid ${T.lineStrong}`,
  background: T.surfaceAlt,
  fontSize: 14,
  fontFamily: F,
  color: T.ink,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function LoginButtonInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [devOpen, setDevOpen]     = useState(false)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const redirect    = searchParams.get('redirect') ?? '/'
  const devEmail    = process.env.NEXT_PUBLIC_DEV_EMAIL
  const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD
  // Show dev login in local dev, or in any environment where NEXT_PUBLIC_DEV_EMAIL is set.
  // NODE_ENV is inlined at build time — the block is dead code in production builds.
  const showDevLogin = process.env.NODE_ENV === 'development' || !!devEmail

  async function signInWithGoogle() {
    const supabase   = createClient()
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  }

  async function signIn() {
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    router.push(redirect); router.refresh()
  }

  async function devLogin() {
    if (!devEmail || !devPassword) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword })
    if (authError) { setError(authError.message); setLoading(false); return }
    router.push(redirect); router.refresh()
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Google OAuth — primary CTA */}
      <button
        onClick={signInWithGoogle}
        style={{
          width: '100%', height: 56, borderRadius: 18,
          background: T.surface, color: T.ink,
          border: 'none', cursor: 'pointer',
          fontFamily: F, fontSize: 16, fontWeight: 700, letterSpacing: -0.1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          boxShadow: '0 2px 14px rgba(31,26,20,0.09), 0 0 0 0.5px rgba(31,26,20,0.06)',
        }}
      >
        <GoogleIcon size={20}/> Continue with Google
      </button>

      {/* terms */}
      <div style={{
        fontSize: 11, color: T.inkFaint, textAlign: 'center',
        lineHeight: 1.5, padding: '0 16px', fontFamily: F,
      }}>
        By continuing you agree to our <u>Terms</u> and <u>Privacy Policy</u>.
      </div>

      {/* dev section — shown in development or when NEXT_PUBLIC_DEV_EMAIL is set */}
      {showDevLogin && (
        <div style={{ marginTop: 4 }}>
          <button
            onClick={() => setDevOpen(o => !o)}
            style={{
              width: '100%', padding: '8px', borderRadius: T.r.md,
              background: 'transparent', border: `1px dashed ${T.lineStrong}`,
              color: T.inkFaint, fontSize: 11, fontWeight: 600, fontFamily: F,
              cursor: 'pointer', letterSpacing: 0.3,
            }}
          >
            {devOpen ? '▲' : '▼'} Dev login
          </button>

          {devOpen && (
            <div style={{
              marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8,
              padding: '12px', borderRadius: T.r.md, background: T.surfaceAlt,
            }}>
              <input
                type="email" autoComplete="email" placeholder="Email"
                value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password" autoComplete="current-password" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && signIn()}
                style={inputStyle}
              />
              {error && <div style={{ fontSize: 12, color: T.coralInk }}>{error}</div>}
              <button
                onClick={devLogin}
                disabled={loading}
                style={{
                  padding: '9px', background: T.sunSoft, color: T.sunInk,
                  border: `1.5px solid ${T.sun}`, borderRadius: T.r.md,
                  fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                }}
              >
                ⚡ {devEmail}
              </button>
              <button
                onClick={signIn}
                disabled={loading || !email || !password}
                style={{
                  padding: '9px', background: T.ink, color: T.bg,
                  border: 'none', borderRadius: T.r.md,
                  fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                  opacity: loading || !email || !password ? 0.4 : 1,
                }}
              >
                {loading ? 'Signing in…' : 'Sign in with email'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LoginButton() {
  return (
    <Suspense fallback={null}>
      <LoginButtonInner/>
    </Suspense>
  )
}
