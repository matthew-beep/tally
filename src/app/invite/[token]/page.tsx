'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { postJson } from '@/lib/api'
import { T, F, FH } from '@/design/tokens'

type MemberStatus = 'pending' | 'none'
type PageState   = 'loading' | 'invalid' | 'ready' | 'declined'

export default function InvitePage() {
  const params = useParams()
  const token  = params.token as string
  const router = useRouter()

  const [pageState,    setPageState]    = useState<PageState>('loading')
  const [group,        setGroup]        = useState<{ id: string; name: string; emoji: string } | null>(null)
  const [memberStatus, setMemberStatus] = useState<MemberStatus>('none')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace(`/login?redirect=/invite/${token}`)
        return
      }

      const { data: groupData } = await supabase
        .from('groups')
        .select('id, name, emoji')
        .eq('invite_token', token)
        .single()

      if (!groupData) { setPageState('invalid'); return }
      setGroup(groupData)

      const { data: membership } = await supabase
        .from('group_members')
        .select('status')
        .eq('group_id', groupData.id)
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (membership?.status === 'active') {
        router.replace(`/groups/${groupData.id}`)
        return
      }

      setMemberStatus(membership?.status === 'pending' ? 'pending' : 'none')
      setPageState('ready')
    }
    load()
  }, [token, router])

  async function handleAccept() {
    if (!group || submitting) return
    setSubmitting(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    if (memberStatus === 'pending') {
      await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('group_id', group.id)
        .eq('user_id', session.user.id)
        .eq('status', 'pending')
    } else {
      await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: session.user.id, status: 'active' })
    }

    router.push(`/groups/${group.id}`)
  }

  async function handleDecline() {
    if (!group || submitting) return
    setSubmitting(true)
    setError(null)

    if (memberStatus === 'pending') {
      try {
        await postJson('/api/invite/decline', { groupId: group.id })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong — try again')
        setSubmitting(false)
        return
      }
    }

    setPageState('declined')
    setTimeout(() => router.push('/'), 2000)
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
          <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Invite not found</div>
          <div style={{ fontSize: 13, color: T.inkMuted }}>This link may have expired or is invalid.</div>
        </div>
      </div>
    )
  }

  if (pageState === 'declined') {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', fontFamily: F }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Got it</div>
          <div style={{ fontSize: 13, color: T.inkMuted }}>You declined the invite. Heading home…</div>
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

        {/* Group card */}
        <div style={{
          background: T.surface, borderRadius: 24,
          padding: '32px 28px', textAlign: 'center',
          boxShadow: T.shadow, marginBottom: 16,
        }}>
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>{group?.emoji}</div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
            textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8,
          }}>
            {memberStatus === 'pending' ? "You've been invited to" : "Join this group"}
          </div>
          <div style={{
            fontFamily: FH, fontSize: 28, fontWeight: 700,
            letterSpacing: -0.8, color: T.ink, marginBottom: 10,
          }}>
            {group?.name}
          </div>
          <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.5 }}>
            {memberStatus === 'pending'
              ? 'Accept to see expenses and your balance.'
              : 'Join to track shared expenses with this group.'}
          </div>
        </div>

        {/* Actions */}
        {error && (
          <div style={{ fontSize: 13, color: T.coralInk, textAlign: 'center', marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleAccept}
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
            {submitting ? 'Joining…' : memberStatus === 'pending' ? '✓ Accept invite' : '✓ Join group'}
          </button>
          <button
            onClick={handleDecline}
            disabled={submitting}
            style={{
              width: '100%', padding: '16px', borderRadius: 16,
              border: `1.5px solid ${T.lineStrong}`, background: 'transparent',
              color: T.inkMuted,
              fontFamily: F, fontSize: 14, fontWeight: 600,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {memberStatus === 'pending' ? 'Decline' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  )
}
