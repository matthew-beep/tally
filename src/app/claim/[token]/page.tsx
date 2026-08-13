'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { T, F, FH } from '@/design/tokens'
import { SectionLabel } from '@/components/SectionLabel'

type PageState = 'loading' | 'invalid' | 'already_claimed' | 'ready'

interface SeatPreview {
  group_id: string
  group_name: string
  group_emoji: string
  seat_name: string
  status: 'valid' | 'already_claimed'
}

export default function ClaimPage() {
  const params = useParams()
  const token  = params.token as string
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [seat,       setSeat]       = useState<SeatPreview | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,       setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Works for a visitor with no session at all — get_seat_by_claim_token
      // is a SECURITY DEFINER RPC, same mechanism as the invite-link fix.
      const { data } = await supabase.rpc('get_seat_by_claim_token', { token })
      const seatData = (data?.[0] as SeatPreview | undefined) ?? null

      if (!seatData) { setPageState('invalid'); return }
      if (seatData.status === 'already_claimed') { setPageState('already_claimed'); return }

      setSeat(seatData)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace(`/login?redirect=/claim/${token}`)
        return
      }

      setPageState('ready')
    }
    load()
  }, [token, router])

  async function handleClaim() {
    if (!seat || submitting) return
    setSubmitting(true)
    setError(null)

    const supabase = createClient()

    // claim_seat is SECURITY DEFINER — a plain client UPDATE can't do this
    // write because no SELECT policy grants a fresh claimer visibility into
    // a row whose user_id is still NULL (RLS requires read access to match
    // rows before an UPDATE policy is even consulted). See claim_flow.sql.
    const { data, error: claimError } = await supabase.rpc('claim_seat', { token })
    const claimed = data?.[0] ?? null

    if (claimError?.code === '23505') {
      setError("You're already connected to this group.")
      setSubmitting(false)
      return
    }
    if (claimError || !claimed) {
      setError('This seat was already claimed — try refreshing.')
      setSubmitting(false)
      return
    }

    router.push(`/groups/${claimed.group_id}`)
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: T.inkMuted, fontFamily: F }}>Loading…</div>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', fontFamily: F }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Claim link not found</div>
          <div style={{ fontSize: 13, color: T.inkMuted }}>This link may have expired or is invalid.</div>
        </div>
      </div>
    )
  }

  if (pageState === 'already_claimed') {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', fontFamily: F }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Already claimed</div>
          <div style={{ fontSize: 13, color: T.inkMuted }}>This seat has already been claimed by someone.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', background: T.bg, fontFamily: F,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: T.sun, color: T.sunInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, fontFamily: FH,
          }}>T</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5, fontFamily: FH }}>tally</span>
        </div>

        {/* Seat card */}
        <div style={{
          background: T.surface, borderRadius: 24,
          padding: '32px 28px', textAlign: 'center',
          boxShadow: T.shadow, marginBottom: 16,
        }}>
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>{seat?.group_emoji}</div>
          <SectionLabel style={{ marginBottom: 8 }}>Claim your seat in</SectionLabel>
          <div style={{
            fontFamily: FH, fontSize: 28, fontWeight: 700,
            letterSpacing: -0.8, color: T.ink, marginBottom: 10,
          }}>
            {seat?.group_name}
          </div>
          <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>
            You'll take over <strong style={{ color: T.ink }}>{seat?.seat_name}</strong>'s expense history — nothing changes for anyone else in the group.
          </div>
        </div>

        {/* Actions */}
        {error && (
          <div style={{ fontSize: 13, color: T.coralInk, textAlign: 'center', marginBottom: 12 }}>{error}</div>
        )}
        <button
          onClick={handleClaim}
          disabled={submitting}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: T.mint, color: 'white',
            fontFamily: FH, fontSize: 16, fontWeight: 600, letterSpacing: -0.2,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            boxShadow: '0 6px 16px rgba(45,185,122,0.28)',
            transition: 'opacity 0.15s',
          }}
        >
          {submitting ? 'Claiming…' : '✓ Claim this seat'}
        </button>
      </div>
    </div>
  )
}
