'use client'

import { T, F } from '@/design/tokens'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function LoginButtonInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function signIn() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    router.push(searchParams.get('redirect') ?? '/')
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: T.r.md,
    border: `1.5px solid ${T.lineStrong}`,
    background: T.surfaceAlt,
    fontSize: 15,
    fontFamily: F,
    color: T.ink,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const devEmail    = process.env.NEXT_PUBLIC_DEV_EMAIL
  const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD

  async function devLogin() {
    if (!devEmail || !devPassword) return
    setEmail(devEmail)
    setPassword(devPassword)
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword })
    if (authError) { setError(authError.message); setLoading(false); return }
    router.push(searchParams.get('redirect') ?? '/')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
      <input
        type="email"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !loading && signIn()}
        style={inputStyle}
      />
      {error && (
        <div style={{ fontSize: 12, color: T.coralInk }}>{error}</div>
      )}
      {devEmail && (
        <button
          onClick={devLogin}
          disabled={loading}
          style={{ padding: '10px', background: T.sunSoft, color: T.sunInk, border: `1.5px solid ${T.sun}`, borderRadius: T.r.md, fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer', width: '100%' }}
        >
          ⚡ Dev login ({devEmail})
        </button>
      )}
      <button
        onClick={signIn}
        disabled={loading || !email || !password}
        style={{
          padding: '14px 24px',
          background: T.ink,
          color: T.bg,
          border: 'none',
          borderRadius: T.r.lg,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: F,
          cursor: 'pointer',
          width: '100%',
          opacity: loading || !email || !password ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </div>
  )
}

export function LoginButton() {
  return (
    <Suspense fallback={null}>
      <LoginButtonInner />
    </Suspense>
  )
}
