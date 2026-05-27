'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { T, F, FH, FMONO } from '@/design/tokens'
import type { Profile } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────

function suggestFromName(name: string): string {
  return name.toLowerCase().split(' ')[0]?.replace(/[^a-z0-9]/g, '').slice(0, 20) ?? ''
}

function isValidHandle(h: string): boolean {
  return h.length >= 3 && h.length <= 30 && /^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(h)
}

function generateSuggestions(name: string, taken: string): string[] {
  const base  = taken.replace(/[._]/g, '')
  const parts = name.toLowerCase().split(' ').map(p => p.replace(/[^a-z0-9]/g, '')).filter(Boolean)
  const yr    = new Date().getFullYear().toString().slice(-2)
  const candidates: string[] = [
    base + yr,
    base + '1',
    parts.length >= 2 ? parts[0] + parts[1][0]  : '',
    parts.length >= 2 ? parts[0][0] + parts[1]  : '',
  ]
  return candidates
    .filter(s => s && s !== taken && s.length >= 3 && /^[a-z][a-z0-9._]*[a-z0-9]$/.test(s))
    .slice(0, 3)
}

// ── status pip icons ──────────────────────────────────────────────────────

function PipCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-6" stroke={T.mintInk} strokeWidth="2"
        fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function PipX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke={T.coralInk} strokeWidth="2"
        fill="none" strokeLinecap="round"/>
    </svg>
  )
}

function PipSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
      style={{ animation: 'tally-spin 0.9s linear infinite' }}>
      <circle cx="8" cy="8" r="5.5" stroke={T.inkFaint} strokeWidth="1.5"
        fill="none" strokeDasharray="9 5"/>
    </svg>
  )
}

// ── main inner component ──────────────────────────────────────────────────

type HandleState = 'empty' | 'invalid' | 'checking' | 'taken' | 'available'

function OnboardingInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [handle,      setHandle]      = useState('')
  const [state,       setState]       = useState<HandleState>('empty')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [saving,      setSaving]      = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // ── load profile ────────────────────────────────────────────────────────
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

  // ── debounced availability check ─────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!handle)               { setState('empty');   return }
    if (!isValidHandle(handle)){ setState('invalid'); return }

    setState('checking')
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('profiles').select('id')
        .eq('handle', handle)
        .neq('id', session.user.id)
        .limit(1)
      if (data?.length) {
        setState('taken')
        setSuggestions(generateSuggestions(profile?.name ?? '', handle))
      } else {
        setState('available')
        setSuggestions([])
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [handle, profile?.name])

  // ── save handle ──────────────────────────────────────────────────────────
  async function claimHandle() {
    if (state !== 'available' || !profile || saving) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles').update({ handle }).eq('id', profile.id)
    if (error) { setSaving(false); return }
    router.replace(searchParams.get('redirect') ?? '/')
  }

  // ── derived display values ────────────────────────────────────────────────
  const displayName = profile?.display_name ?? profile?.name ?? '…'

  const borderColor =
    state === 'available' ? T.mint :
    state === 'taken' || state === 'invalid' ? T.coral :
    T.lineStrong

  const statusText =
    state === 'checking' ? `Checking @${handle}…` :
    state === 'taken'    ? `@${handle} is taken. Try one of these:` :
    state === 'available'? `@${handle} is yours.` :
    state === 'invalid'  ? 'Min 3 chars. Letters, numbers, . and _ only.' :
                           'A unique handle. Letters, numbers, . and _ only.'

  const statusColor =
    state === 'available' ? T.mintInk :
    state === 'taken' || state === 'invalid' ? T.coralInk :
    T.inkMuted

  const ctaEnabled = state === 'available' && !saving

  return (
    <div style={{
      minHeight: '100dvh', background: T.bg,
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100dvh',
        display: 'flex', flexDirection: 'column',
        color: T.ink, fontFamily: F,
      }}>
        {/* status bar / safe area */}
        <div style={{ height: 54, flexShrink: 0 }}/>

        {/* step indicator + identity chip */}
        <div style={{
          padding: '4px 20px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
            textTransform: 'uppercase', color: T.inkMuted,
          }}>
            Step 1 of 1
          </div>
          {profile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: T.surface, padding: '4px 10px 4px 6px',
              borderRadius: T.r.pill, boxShadow: T.shadowSm,
            }}>
              <Avatar profile={profile} slot={0} size={20} isYou/>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted }}>
                {displayName}
              </span>
            </div>
          )}
        </div>

        {/* scroll content */}
        <div style={{ flex: 1, padding: '32px 24px 0', display: 'flex', flexDirection: 'column' }}>

          {/* heading */}
          <div style={{
            fontFamily: FH, fontSize: 34, fontWeight: 600,
            letterSpacing: -1.2, lineHeight: 1.08,
          }}>
            Pick your{' '}
            <span style={{
              background: T.sunSoft, color: T.sunInk,
              padding: '0 8px', borderRadius: 8,
            }}>
              handle
            </span>
          </div>
          <div style={{
            marginTop: 10, fontSize: 14, color: T.inkMuted,
            lineHeight: 1.5, maxWidth: 320,
          }}>
            Friends use your handle to add you to groups. You can change it later.
          </div>

          {/* handle input */}
          <div style={{ marginTop: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: T.surface, borderRadius: 18,
              padding: '16px 18px 16px 22px',
              boxShadow: `inset 0 0 0 1.5px ${borderColor}, 0 1px 0 rgba(31,26,20,0.04)`,
              transition: 'box-shadow 0.18s',
            }}>
              <span style={{
                fontFamily: FH, fontSize: 28, fontWeight: 600, letterSpacing: -0.6,
                color: T.inkFaint, flexShrink: 0, userSelect: 'none',
              }}>@</span>
              <input
                type="text"
                value={handle}
                onChange={e => {
                  const clean = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._]/g, '')
                    .slice(0, 30)
                  setHandle(clean)
                }}
                placeholder="yourhandle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Choose your handle"
                style={{
                  flex: 1, minWidth: 0,
                  border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: FH, fontSize: 28, fontWeight: 600,
                  color: T.ink, letterSpacing: -0.6, lineHeight: 1,
                }}
              />
              {/* status pip */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background:
                  state === 'available' ? T.mintSoft  :
                  state === 'taken' || state === 'invalid' ? T.coralSoft :
                  state === 'checking' ? T.surfaceAlt : 'transparent',
                transition: 'background 0.18s',
              }}>
                {state === 'available' && <PipCheck/>}
                {(state === 'taken' || state === 'invalid') && <PipX/>}
                {state === 'checking' && <PipSpinner/>}
              </div>
            </div>

            {/* status message */}
            <div style={{
              marginTop: 10, padding: '0 4px',
              fontSize: 12, lineHeight: 1.5, fontWeight: 600,
              color: statusColor, minHeight: 18,
            }}>
              {statusText}
            </div>

            {/* suggestion chips */}
            {state === 'taken' && suggestions.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => setHandle(s)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '8px 14px 8px 12px', borderRadius: T.r.pill,
                    background: T.surface, color: T.ink,
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, fontFamily: F,
                    boxShadow: `inset 0 0 0 1px ${T.lineStrong}`,
                  }}>
                    <span style={{ color: T.inkFaint, fontWeight: 500, fontSize: 12 }}>@</span>{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* identity preview */}
          {profile && (
            <div style={{ marginTop: 36 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                textTransform: 'uppercase', color: T.inkMuted,
                marginBottom: 10, padding: '0 4px',
              }}>
                This is what friends see
              </div>
              <div style={{
                background: T.surface, borderRadius: 18, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: T.shadowSm,
              }}>
                <Avatar profile={profile} slot={0} size={46} isYou/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>
                    {displayName}
                  </div>
                  <div style={{
                    fontFamily: FMONO, fontSize: 12, color: T.inkMuted,
                    marginTop: 2, fontWeight: 500,
                  }}>
                    @{handle || 'yourhandle'}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                  textTransform: 'uppercase', color: T.inkFaint,
                  padding: '4px 8px', borderRadius: 6, background: T.surfaceAlt,
                  flexShrink: 0,
                }}>
                  preview
                </span>
              </div>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 32 }}/>
        </div>

        {/* sticky CTA */}
        <div style={{
          padding: '0 20px 40px',
          flexShrink: 0,
          background: `linear-gradient(to top, ${T.bg} 70%, transparent)`,
        }}>
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
      <OnboardingInner/>
    </Suspense>
  )
}
