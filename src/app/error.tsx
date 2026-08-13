'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { T, F, FH } from '@/design/tokens'
import { Btn } from '@/components/Btn'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        textAlign: 'center',
        background: T.bg,
        color: T.ink,
      }}
    >
      <div style={{ fontSize: 40 }}>😵‍💫</div>
      <div>
        <h1 style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.3, margin: '0 0 6px' }}>
          Something went wrong
        </h1>
        <p style={{ fontFamily: F, fontSize: 14.5, color: T.inkMuted, margin: 0, maxWidth: 320 }}>
          Nothing was lost — this screen just hit a snag. Try again, or head back home.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn
          onClick={reset} variant="dark" size="lg"
          style={{ padding: '11px 20px', borderRadius: T.r.lg, color: T.surface, fontFamily: F, fontSize: 14 }}
        >
          Try again
        </Btn>
        <Link
          href="/"
          style={{
            padding: '11px 20px', borderRadius: T.r.lg, textDecoration: 'none',
            boxShadow: `inset 0 0 0 1px ${T.lineStrong}`, color: T.inkMuted,
            font: 'inherit', fontFamily: F, fontSize: 14, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
