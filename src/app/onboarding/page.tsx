'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { HandleInput } from '@/components/HandleInput'
import type { HandleState } from '@/components/HandleInput'
import { T, F, FH, FMONO } from '@/design/tokens'
import type { Profile } from '@/types'

function suggestFromName(name: string): string {
  return name.toLowerCase().split(' ')[0]?.replace(/[^a-z0-9]/g, '').slice(0, 20) ?? ''
}

function OnboardingInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [handle,      setHandle]      = useState('')
  const [handleState, setHandleState] = useState<HandleState>('empty')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      supabase
        .from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (!data) return
          const p = data as Profile
          setProfile(p)
          const initial = p.handle ?? suggestFromName(p.name)
          if (initial) setHandle(initial)
        })
    })
  }, [router])

  async function claimHandle() {
    if (handleState !== 'available' || !profile || saving) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles').update({ handle }).eq('id', profile.id)
    if (error) { setSaving(false); return }
    router.replace(searchParams.get('redirect') ?? '/')
  }

  const displayName = profile?.display_name ?? profile?.name ?? '…'
  const ctaEnabled  = handleState === 'available' && !saving

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100dvh',
        display: 'flex', flexDirection: 'column',
        color: T.ink, fontFamily: F,
      }}>
        {/* safe area */}
        <div style={{ height: 54, flexShrink: 0 }} />

        {/* step + identity chip */}
        <div style={{ padding: '4px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted }}>
            Step 1 of 1
          </div>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surface, padding: '4px 10px 4px 6px', borderRadius: T.r.pill, boxShadow: T.shadowSm }}>
              <Avatar profile={profile} slot={0} size={20} isYou />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted }}>{displayName}</span>
            </div>
          )}
        </div>

        {/* content */}
        <div style={{ flex: 1, padding: '32px 24px 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: FH, fontSize: 34, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.08 }}>
            Pick your{' '}
            <span style={{ background: T.sunSoft, color: T.sunInk, padding: '0 8px', borderRadius: 8 }}>
              handle
            </span>
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: T.inkMuted, lineHeight: 1.5, maxWidth: 320 }}>
            Friends use your handle to add you to groups. You can change it later.
          </div>

          <div style={{ marginTop: 32 }}>
            {profile && (
              <HandleInput
                value={handle}
                onChange={setHandle}
                currentProfileId={profile.id}
                currentHandle={profile.handle}
                profileName={profile.name}
                onStateChange={setHandleState}
              />
            )}
          </div>

          {/* identity preview */}
          {profile && (
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10, padding: '0 4px' }}>
                This is what friends see
              </div>
              <div style={{ background: T.surface, borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: T.shadowSm }}>
                <Avatar profile={profile} slot={0} size={46} isYou />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{displayName}</div>
                  <div style={{ fontFamily: FMONO, fontSize: 12, color: T.inkMuted, marginTop: 2, fontWeight: 500 }}>
                    @{handle || 'yourhandle'}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkFaint, padding: '4px 8px', borderRadius: 6, background: T.surfaceAlt, flexShrink: 0 }}>
                  preview
                </span>
              </div>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 32 }} />
        </div>

        {/* sticky CTA */}
        <div style={{ padding: '0 20px 40px', flexShrink: 0, background: `linear-gradient(to top, ${T.bg} 70%, transparent)` }}>
          <button
            onClick={claimHandle}
            disabled={!ctaEnabled}
            style={{
              width: '100%', height: 56, borderRadius: 18,
              background: ctaEnabled ? T.sun : T.lineStrong,
              color: ctaEnabled ? T.sunInk : T.inkFaint,
              border: 'none',
              cursor: ctaEnabled ? 'pointer' : 'default',
              fontFamily: FH, fontSize: 17, fontWeight: 600, letterSpacing: -0.2,
              boxShadow: ctaEnabled ? '0 8px 20px rgba(242,192,74,0.35)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s, color 0.2s',
            }}
          >
            {saving ? 'Saving…' : ctaEnabled ? `Claim @${handle}` : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}
