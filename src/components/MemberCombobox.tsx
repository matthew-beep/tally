'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { T, F, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useSearchProfiles } from '@/queries/useProfile'
import type { ProfileSnippet } from '@/queries/useProfile'

export type MemberEntry =
  | { type: 'user'; profile: ProfileSnippet }
  | { type: 'guest'; name: string; tempId: string }

interface Props {
  value: MemberEntry[]
  onChange: (entries: MemberEntry[]) => void
  excludeIds?: string[]
  placeholder?: string
  autoFocus?: boolean
}

function hashSlot(id: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

function Chip({ entry, onRemove }: { entry: MemberEntry; onRemove: () => void }) {
  const isGuest = entry.type === 'guest'
  const name = isGuest ? entry.name : (entry.profile.display_name ?? entry.profile.name)

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px 3px 3px', borderRadius: 999, flexShrink: 0,
      background: isGuest ? T.surfaceAlt : T.ink,
      border: isGuest ? `1.5px dashed ${T.lineStrong}` : 'none',
      color: isGuest ? T.inkMuted : T.bg,
      fontSize: 12, fontWeight: 700,
    }}>
      {isGuest ? (
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: `1.5px dashed ${T.lineStrong}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: T.inkMuted, background: T.bg,
        }}>
          {name[0]?.toUpperCase() ?? '?'}
        </div>
      ) : (
        <Avatar profile={entry.profile} slot={hashSlot(entry.profile.id)} size={20} />
      )}
      {name.split(' ')[0]}
      <button
        onMouseDown={e => { e.preventDefault(); onRemove() }}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          background: isGuest ? 'rgba(31,26,20,0.1)' : 'rgba(255,255,255,0.18)',
          color: isGuest ? T.inkMuted : T.bg,
          border: 0, cursor: 'pointer', marginLeft: -2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <svg width="6" height="6" viewBox="0 0 8 8"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </button>
    </span>
  )
}

export function MemberCombobox({ value, onChange, excludeIds = [], placeholder = 'Add people…', autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const trimmed = query.trim()
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(trimmed), 250)
    return () => clearTimeout(id)
  }, [trimmed])

  const { data: searchResults = [], isLoading } = useSearchProfiles(debouncedQuery)

  const selectedIds = useMemo(() =>
    new Set(value.filter(e => e.type === 'user').map(e => (e as Extract<MemberEntry, { type: 'user' }>).profile.id)),
    [value]
  )

  const filteredResults = useMemo(() =>
    searchResults.filter(p => !excludeIds.includes(p.id) && !selectedIds.has(p.id)),
    [searchResults, excludeIds, selectedIds]
  )

  const showDropdown = open && trimmed.length >= 2

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(profile: ProfileSnippet) {
    onChange([...value, { type: 'user', profile }])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function addGuest(name: string) {
    onChange([...value, { type: 'guest', name: name.trim(), tempId: `guest-${Date.now()}` }])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          padding: '8px 10px', borderRadius: T.r.md, minHeight: 44,
          border: `1.5px solid ${open ? T.lineStrong : T.line}`,
          background: T.surfaceAlt, cursor: 'text',
          transition: 'border-color 0.15s',
        }}
      >
        {value.map((entry, i) => (
          <Chip key={entry.type === 'guest' ? entry.tempId : entry.profile.id} entry={entry} onRemove={() => remove(i)} />
        ))}
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (trimmed.length >= 2) setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !query && value.length > 0) remove(value.length - 1)
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            flex: 1, minWidth: 100, background: 'none', border: 'none', outline: 'none',
            fontSize: 14, color: T.ink, fontFamily: F,
          }}
        />
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: T.surface, borderRadius: T.r.lg,
          boxShadow: T.shadowFloat, overflow: 'hidden',
        }}>
          {isLoading && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: T.inkFaint, fontFamily: F }}>
              Searching…
            </div>
          )}

          {!isLoading && filteredResults.map((p, i) => (
            <button
              key={p.id}
              onMouseDown={e => { e.preventDefault(); select(p) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: 'transparent', border: 'none',
                borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}`,
                cursor: 'pointer', font: 'inherit', textAlign: 'left',
              }}
            >
              <Avatar profile={p} slot={hashSlot(p.id)} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                  {p.display_name ?? p.name}
                </div>
                {p.handle ? (
                  <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: FMONO, letterSpacing: 0.8 }}>
                    {p.handle}
                  </div>
                ) : <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: FMONO, letterSpacing: 0.8 }}>
                    no handle found
                  </div>}
                {p.add_code && (
                  <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: FMONO, letterSpacing: 0.8 }}>
                    {p.add_code}
                  </div>
                )}
              </div>
            </button>
          ))}

          {!isLoading && filteredResults.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 13, color: T.inkFaint, fontFamily: F }}>
              No Tally users found
            </div>
          )}

          <button
            onMouseDown={e => { e.preventDefault(); addGuest(trimmed) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: T.sunSoft, border: 'none',
              borderTop: `0.5px solid ${T.line}`,
              cursor: 'pointer', font: 'inherit', textAlign: 'left',
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              border: `1.5px dashed ${T.lineStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: T.inkMuted, background: T.bg,
            }}>+</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.sunInk }}>
                Add "{trimmed}" as guest
              </div>
              <div style={{ fontSize: 11, color: T.inkMuted }}>No Tally account needed</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
