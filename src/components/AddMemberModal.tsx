'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useSearchProfiles } from '@/queries/useProfile'
import type { ProfileSnippet } from '@/queries/useProfile'
import { useAddGroupMember, useRecentCollaborators } from '@/queries/useMembers'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const ADD_CODE_RE = /^[A-Z0-9]{8}$/

function hashSlot(id: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  if (!query.trim()) return [{ text, hit: false }]
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'ig')
  return text.split(re).map(part => ({ text: part, hit: re.test(part) && (re.lastIndex = 0, true) }))
}

function Hi({ text, query }: { text: string; query: string }) {
  return (
    <>{highlight(text, query).map((p, i) =>
      p.hit
        ? <span key={i} style={{ background: '#F9E2A8', padding: '0 2px', borderRadius: 3 }}>{p.text}</span>
        : <span key={i}>{p.text}</span>
    )}</>
  )
}

function PersonRow({
  profile, query, isSelected, isAdded, isExisting, context, onRowClick,
}: {
  profile: ProfileSnippet
  query: string
  isSelected: boolean
  isAdded: boolean
  isExisting: boolean
  context: 'create' | 'group'
  onRowClick: (p: ProfileSnippet) => void
}) {
  const displayName = profile.display_name ?? profile.name
  const disabled = isExisting || isAdded

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      opacity: disabled ? 0.45 : 1,
      transition: 'background 0.1s',
    }}>
      <Avatar profile={profile} slot={hashSlot(profile.id)} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Hi text={displayName} query={query} />
        </div>
        {profile.add_code && (
          <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1, fontFamily: FMONO, letterSpacing: 0.8 }}>
            {profile.add_code}
          </div>
        )}
      </div>
      {isExisting ? (
        <span style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, flexShrink: 0 }}>In group</span>
      ) : isAdded ? (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.mintSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 7l3 3 7-7" stroke={T.mintInk} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      ) : isSelected && context === 'create' ? (
        <button
          onClick={() => onRowClick(profile)}
          style={{ width: 28, height: 28, borderRadius: '50%', background: T.ink, color: T.bg, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 7l3 3 7-7" stroke={T.bg} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      ) : (
        <button
          onClick={() => onRowClick(profile)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: T.surfaceAlt, color: T.ink, border: 0, cursor: 'pointer',
            fontSize: 18, lineHeight: 1, fontFamily: FH, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >+</button>
      )}
    </div>
  )
}

function ResultGroup({
  label, count, note, profiles, query, selectedIds, addedIds, existingMemberIds, context, onRowClick,
}: {
  label: string
  count: number
  note: string
  profiles: ProfileSnippet[]
  query: string
  selectedIds: Set<string>
  addedIds: Set<string>
  existingMemberIds: string[]
  context: 'create' | 'group'
  onRowClick: (p: ProfileSnippet) => void
}) {
  if (profiles.length === 0) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted }}>
          {label} <span style={{ color: T.inkFaint, fontFamily: FMONO }}>{count}</span>
        </div>
        <div style={{ fontSize: 10, color: T.inkFaint }}>{note}</div>
      </div>
      <div style={{ background: T.surface, borderRadius: 12, overflow: 'hidden' }}>
        {profiles.map((p, i) => (
          <div key={p.id} style={{ borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}` }}>
            <PersonRow
              profile={p}
              query={query}
              isSelected={selectedIds.has(p.id)}
              isAdded={addedIds.has(p.id)}
              isExisting={existingMemberIds.includes(p.id)}
              context={context}
              onRowClick={onRowClick}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  group: { id: string; name: string; emoji: string; invite_token?: string | null }
  existingMemberIds: string[]
  context: 'create' | 'group'
  onDone?: (selected: ProfileSnippet[]) => void
}

export function AddMemberModal({ open, onClose, group, existingMemberIds, context, onDone }: AddMemberModalProps) {
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ProfileSnippet[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addMember = useAddGroupMember(group.id)
  const { data: recents = [] } = useRecentCollaborators()
  const trimmed = query.trim()
  const isAddCode = ADD_CODE_RE.test(trimmed.toUpperCase())
  // Debounce the DB-bound fuzzy search only — isAddCode/hero-card logic
  // below stays on the immediate value since it's a local regex, not a query.
  const debouncedQuery = useDebouncedValue(trimmed, 250)
  const { data: searchResults = [] } = useSearchProfiles(isAddCode ? '' : debouncedQuery)

  const selectedIds = useMemo(() => new Set(selected.map(p => p.id)), [selected])
  const allExcludeIds = useMemo(() => [...existingMemberIds, ...addedIds], [existingMemberIds, addedIds])

  const codeMatch = isAddCode
    ? (recents.find(p => p.add_code === trimmed.toUpperCase()) ?? null)
    : null

  const filteredRecents = useMemo(() => {
    const q = trimmed.toLowerCase()
    return recents.filter(p => {
      if (allExcludeIds.includes(p.id) && context === 'group') return false
      if (!q) return true
      const name = (p.display_name ?? p.name).toLowerCase()
      return name.includes(q) || (p.add_code ?? '').toLowerCase().includes(q)
    })
  }, [recents, trimmed, allExcludeIds, context])

  const recentsIds = useMemo(() => new Set(filteredRecents.map(p => p.id)), [filteredRecents])

  const filteredResults = useMemo(() =>
    searchResults.filter(p => !recentsIds.has(p.id) && (context !== 'group' || !allExcludeIds.includes(p.id))),
    [searchResults, recentsIds, allExcludeIds, context]
  )

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected([])
      setAddedIds(new Set())
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !mounted) return null

  function handleRowClick(p: ProfileSnippet) {
    if (context === 'group') {
      setAddedIds(prev => new Set([...prev, p.id]))
      addMember.mutate(p, {
        onError: () => setAddedIds(prev => { const s = new Set(prev); s.delete(p.id); return s }),
      })
    } else {
      setSelected(prev =>
        prev.some(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]
      )
    }
  }

  function handleDone() {
    onDone?.(selected)
    onClose()
  }

  function handleCopyLink() {
    if (!group.invite_token) return
    const url = `${window.location.origin}/invite/${group.invite_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const showRightPanel = context === 'group' && !!group.invite_token
  const inviteUrl = group.invite_token
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://tally.app'}/invite/${group.invite_token}`
    : null

  const showHeroCard = isAddCode && codeMatch
  const showEmptyState = !isAddCode && filteredRecents.length === 0 && filteredResults.length === 0

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 36 }}>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(31,26,20,0.32)' }}
      />

      {/* Dialog */}
      <div style={{
        position: 'relative', width: showRightPanel ? 640 : 440, maxHeight: '85vh',
        background: T.bg, color: T.ink, borderRadius: 24,
        boxShadow: '0 24px 60px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: F,
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `0.5px solid ${T.line}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
            }}>{group.emoji}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted }}>
                {context === 'create' ? 'Add people to group' : 'Add member'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, marginTop: 1, fontFamily: FH }}>
                {group.name || 'New group'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 10, background: T.surface, color: T.ink, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left: search + results */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: showRightPanel ? `0.5px solid ${T.line}` : 'none' }}>
            {/* Search input */}
            <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: T.surface, borderRadius: 12, padding: '10px 14px',
                boxShadow: isAddCode ? `inset 0 0 0 1.5px ${T.sun}` : 'none',
              }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" stroke={isAddCode ? T.sunInk : T.inkMuted} strokeWidth="1.8"/>
                  <path d="M13.5 13.5L18 18" stroke={isAddCode ? T.sunInk : T.inkMuted} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or add code…"
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    fontSize: 14, color: T.ink,
                    fontFamily: isAddCode ? FMONO : F,
                    fontWeight: isAddCode ? 700 : 500,
                    letterSpacing: isAddCode ? 1.2 : -0.1,
                  }}
                />
                {isAddCode && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: T.sunSoft, color: T.sunInk, letterSpacing: 0.6, textTransform: 'uppercase', flexShrink: 0 }}>
                    Add code
                  </span>
                )}
              </div>

              {/* Selected chips (create context) */}
              {context === 'create' && selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {selected.map(p => (
                    <span key={p.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '3px 10px 3px 3px', borderRadius: 999,
                      background: T.ink, color: T.bg, fontSize: 12, fontWeight: 700,
                    }}>
                      <Avatar profile={p} slot={hashSlot(p.id)} size={20} />
                      {(p.display_name ?? p.name).split(' ')[0]}
                      <button
                        onClick={() => setSelected(prev => prev.filter(x => x.id !== p.id))}
                        style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', color: T.bg, border: 0, cursor: 'pointer', marginLeft: -2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="6" height="6" viewBox="0 0 8 8"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 14px' }}>
              {showHeroCard && codeMatch ? (
                <div style={{
                  marginTop: 14, background: T.surface, borderRadius: 16, padding: '16px',
                  boxShadow: `inset 0 0 0 1.5px ${T.sun}`,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <Avatar profile={codeMatch} slot={hashSlot(codeMatch.id)} size={52} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.sunInk, marginBottom: 4 }}>
                      Add code recognized
                    </div>
                    <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.5 }}>
                      {codeMatch.display_name ?? codeMatch.name}
                    </div>
                    {codeMatch.add_code && (
                      <div style={{ fontSize: 11, fontFamily: FMONO, letterSpacing: 1, color: T.inkMuted, marginTop: 2 }}>{codeMatch.add_code}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRowClick(codeMatch)}
                    disabled={addedIds.has(codeMatch.id) || existingMemberIds.includes(codeMatch.id)}
                    style={{
                      padding: '8px 16px', borderRadius: 12,
                      background: addedIds.has(codeMatch.id) ? T.mintSoft : T.sun,
                      color: addedIds.has(codeMatch.id) ? T.mintInk : T.sunInk,
                      border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {addedIds.has(codeMatch.id) ? 'Added ✓' : context === 'create' ? (selectedIds.has(codeMatch.id) ? 'Selected ✓' : 'Select') : 'Add'}
                  </button>
                </div>
              ) : (
                <>
                  <ResultGroup
                    label="Recents"
                    count={filteredRecents.length}
                    note={trimmed ? 'filtered' : ''}
                    profiles={filteredRecents}
                    query={trimmed}
                    selectedIds={selectedIds}
                    addedIds={addedIds}
                    existingMemberIds={existingMemberIds}
                    context={context}
                    onRowClick={handleRowClick}
                  />
                  <ResultGroup
                    label="Search results"
                    count={filteredResults.length}
                    note="from Tally"
                    profiles={filteredResults}
                    query={trimmed}
                    selectedIds={selectedIds}
                    addedIds={addedIds}
                    existingMemberIds={existingMemberIds}
                    context={context}
                    onRowClick={handleRowClick}
                  />
                  {showEmptyState && (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: T.inkFaint, fontSize: 13 }}>
                      {trimmed.length < 2 ? 'Start typing to search for people' : 'No users found'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: other ways (group context only) */}
          {showRightPanel && (
            <aside style={{ width: 200, padding: '18px 16px', background: T.surface, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted }}>
                Other ways
              </div>
              {inviteUrl && (
                <div style={{ background: T.bg, borderRadius: 14, padding: 12, textAlign: 'center' }}>
                  <QRCodeSVG
                    value={inviteUrl}
                    size={152}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    bgColor="transparent"
                  />
                  <div style={{ marginTop: 8, fontSize: 11, color: T.inkMuted, fontWeight: 600 }}>Invite QR code</div>
                </div>
              )}
              <button
                onClick={handleCopyLink}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: T.bg,
                  border: 0, borderRadius: 12, cursor: 'pointer', font: 'inherit',
                  color: copied ? T.mintInk : T.ink, textAlign: 'left', width: '100%',
                }}
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke={T.mintInk} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M8 12l4-4M7.5 12.5l-2 2a2.5 2.5 0 003.5 3.5l2-2M12.5 7.5l2-2a2.5 2.5 0 00-3.5-3.5l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
                <span style={{ fontSize: 12, fontWeight: 700 }}>{copied ? 'Copied!' : 'Copy invite link'}</span>
              </button>
            </aside>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 22px', borderTop: `0.5px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ padding: '2px 6px', borderRadius: 5, background: T.surface, fontFamily: FMONO, fontWeight: 700, fontSize: 10 }}>esc</span>
            to close
          </div>
          {context === 'create' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '9px 14px', borderRadius: 12, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700 }}>
                Cancel
              </button>
              <button
                onClick={handleDone}
                style={{
                  padding: '9px 18px', borderRadius: 12,
                  background: selected.length > 0 ? T.sun : T.surface,
                  color: selected.length > 0 ? T.sunInk : T.inkMuted,
                  border: 0, cursor: selected.length > 0 ? 'pointer' : 'default',
                  font: 'inherit', fontSize: 13, fontWeight: 700,
                }}
              >
                {selected.length > 0 ? `Done · ${selected.length} selected` : 'Done'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.inkMuted }}>They'll get a notification to accept or decline</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
