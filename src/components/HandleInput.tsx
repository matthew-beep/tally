'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { T, FH, F, well } from '@/design/tokens'

// 'error' = the availability lookup itself failed. Distinct from 'invalid'
// (the handle is malformed) so the copy can say so, and distinct from
// 'available' so a failed check can never green-light a taken handle.
export type HandleState = 'empty' | 'invalid' | 'checking' | 'taken' | 'available' | 'error'

// States that render coral + an ✗ pip: something is wrong and the handle
// can't be saved as typed.
const isProblem = (s: HandleState) => s === 'taken' || s === 'invalid' || s === 'error'

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
    parts.length >= 2 ? parts[0] + parts[1][0] : '',
    parts.length >= 2 ? parts[0][0] + parts[1] : '',
  ]
  return candidates
    .filter(s => s && s !== taken && s.length >= 3 && /^[a-z][a-z0-9._]*[a-z0-9]$/.test(s))
    .slice(0, 3)
}

function PipCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-6" stroke={T.mintInk} strokeWidth="2"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PipX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke={T.coralInk} strokeWidth="2"
        fill="none" strokeLinecap="round" />
    </svg>
  )
}

function PipSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
      style={{ animation: 'tally-spin 0.9s linear infinite' }}>
      <circle cx="8" cy="8" r="5.5" stroke={T.inkFaint} strokeWidth="1.5"
        fill="none" strokeDasharray="9 5" />
    </svg>
  )
}

interface HandleInputProps {
  value: string
  onChange: (value: string) => void
  /** Profile ID to exclude from uniqueness check (the current user's own profile) */
  currentProfileId: string
  /** Current saved handle — if value matches this, skip the availability check */
  currentHandle?: string | null
  /** Used to generate alternative suggestions when a handle is taken */
  profileName?: string
  onStateChange?: (state: HandleState) => void
}

export function HandleInput({
  value,
  onChange,
  currentProfileId,
  currentHandle,
  profileName = '',
  onStateChange,
}: HandleInputProps) {
  const [state,       setState]       = useState<HandleState>(() =>
    value && value === currentHandle ? 'available' : value ? 'checking' : 'empty'
  )
  const [suggestions, setSuggestions] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(debounceRef.current)

    // If value is the unchanged saved handle, no check needed
    if (value && value === currentHandle) {
      setState('available')
      setSuggestions([])
      onStateChange?.('available')
      return
    }

    if (!value)                { setState('empty');   onStateChange?.('empty');   return }
    if (!isValidHandle(value)) { setState('invalid'); onStateChange?.('invalid'); return }

    setState('checking')
    onStateChange?.('checking')

    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('handle', value)
        .neq('id', currentProfileId)
        .limit(1)

      // Fail closed. Unchecked, a failed lookup returns no rows and reads as
      // 'available' — so a taken handle gets a green light here and then dies
      // on the UNIQUE constraint at save time with a far less obvious message.
      if (error) {
        setState('error')
        setSuggestions([])
        onStateChange?.('error')
        return
      }

      if (data?.length) {
        setState('taken')
        setSuggestions(generateSuggestions(profileName, value))
        onStateChange?.('taken')
      } else {
        setState('available')
        setSuggestions([])
        onStateChange?.('available')
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [value, currentHandle, currentProfileId, profileName])

  // The recessed well already draws its own edge, so the rim is reserved for
  // validation state — transparent while idle rather than a resting border.
  const rimColor =
    state === 'available' ? T.mint :
    isProblem(state)      ? T.coral :
    'transparent'

  const statusText =
    state === 'checking'  ? `Checking @${value}…` :
    state === 'taken'     ? `@${value} is taken. Try one of these:` :
    state === 'available' ? `@${value} is yours.` :
    state === 'invalid'   ? 'Min 3 chars. Letters, numbers, . and _ only.' :
    state === 'error'     ? `Couldn't check @${value} — check your connection and try again.` :
                            'Letters, numbers, . and _ only. Min 3 chars.'

  const statusColor =
    state === 'available' ? T.mintInk :
    isProblem(state)      ? T.coralInk :
    T.inkMuted

  return (
    <div>
      {/* Input row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        borderRadius: 18,
        padding: '16px 18px 16px 22px',
        ...well(false, rimColor),
      }}>
        <span style={{
          fontFamily: FH, fontSize: 28, fontWeight: 600, letterSpacing: -0.6,
          color: T.inkFaint, flexShrink: 0, userSelect: 'none',
        }}>@</span>
        <input
          type="text"
          value={value}
          onChange={e => {
            const clean = e.target.value
              .toLowerCase()
              .replace(/[^a-z0-9._]/g, '')
              .slice(0, 30)
            onChange(clean)
          }}
          placeholder="yourhandle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Handle"
          style={{
            flex: 1, minWidth: 0,
            border: 'none', outline: 'none', background: 'transparent',
            fontFamily: FH, fontSize: 28, fontWeight: 600,
            color: T.ink, letterSpacing: -0.6, lineHeight: 1,
          }}
        />
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background:
            state === 'available' ? T.mintSoft  :
            isProblem(state)      ? T.coralSoft :
            state === 'checking'  ? T.surfaceAlt : 'transparent',
          transition: 'background 0.18s',
        }}>
          {state === 'available' && <PipCheck />}
          {isProblem(state)      && <PipX />}
          {state === 'checking'  && <PipSpinner />}
        </div>
      </div>

      {/* Status text */}
      <div style={{
        marginTop: 10, padding: '0 4px',
        fontSize: 12, lineHeight: 1.5, fontWeight: 600,
        color: statusColor, minHeight: 18,
      }}>
        {statusText}
      </div>

      {/* Suggestion chips */}
      {state === 'taken' && suggestions.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => onChange(s)} style={{
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
  )
}
