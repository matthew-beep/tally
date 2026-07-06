'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { MemberCombobox } from '@/components/MemberCombobox'
import type { MemberEntry } from '@/components/MemberCombobox'
import { SuggestedMembers } from '@/components/SuggestedMembers'
import { useCreateGroup } from '@/queries/useGroups'
import { avatarProfile } from '@/lib/memberDisplay'
import { useRecentCollaborators } from '@/queries/useMembers'
import { useCurrentProfile, useSearchProfiles } from '@/queries/useProfile'
import type { ProfileSnippet } from '@/queries/useProfile'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import type { Profile } from '@/types'

const EMOJIS = ['💸', '🏖️', '🍕', '✈️', '🏠', '🎉', '🛒', '🚗', '🍽️', '💪', '🎮', '❤️']

// ── Desktop-only components ────────────────────────────────────────────────

type MemberAvatarProfile = Pick<Profile, 'name' | 'display_name' | 'avatar_url'>

function MemberRow({
  displayName, handle, avatarProfile: avatarSrc, slot, isYou, isLast, onRemove,
}: {
  displayName: string
  handle?: string | null
  avatarProfile: MemberAvatarProfile
  slot: 0 | 1 | 2 | 3
  isYou?: boolean
  isLast: boolean
  onRemove?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px',
      borderBottom: isLast ? 'none' : `0.5px solid ${T.line}`,
    }}>
      <Avatar profile={avatarSrc} slot={slot} size={40} isYou={isYou} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isYou ? 'You' : displayName}
        </div>
        {handle && (
          <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 2, fontWeight: 500, letterSpacing: 0.2 }}>
            @{handle}
          </div>
        )}
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
        textTransform: 'uppercase' as const,
        background: isYou ? T.sunSoft : T.surfaceAlt,
        color: isYou ? T.sunInk : T.inkMuted,
        flexShrink: 0,
      }}>
        {isYou ? 'Organizer' : 'Pending'}
      </span>
      {!isYou && onRemove && (
        <button
          onClick={onRemove}
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'transparent', color: T.inkMuted,
            border: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

const labelStyle = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, color: T.inkMuted,
}

function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10">
      <path d="M3 2l3 3-3 3" stroke={T.inkFaint} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💸')
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [mobileQuery, setMobileQuery] = useState('')
  const [mobileQueryDebounced, setMobileQueryDebounced] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const createGroup = useCreateGroup()
  const { data: profile } = useCurrentProfile()
  const { data: recents = [] } = useRecentCollaborators()
  const { data: searchResults = [], isLoading: isSearchLoading } = useSearchProfiles(mobileQueryDebounced)
  const isMobile = useIsMobileSheet()

  useEffect(() => { nameInputRef.current?.focus() }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') router.push('/groups')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setMobileQueryDebounced(mobileQuery.trim()), 250)
    return () => clearTimeout(id)
  }, [mobileQuery])

  async function handleCreate() {
    if (!name.trim() || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const creatorName = profile?.display_name ?? profile?.name ?? 'Unknown'
      const mappedMembers = members.map(entry =>
        entry.type === 'user'
          ? { type: 'user' as const, profileId: entry.profile.id, name: entry.profile.display_name ?? entry.profile.name }
          : { type: 'guest' as const, name: entry.name }
      )
      const { id, membersError } = await createGroup.mutateAsync({ name: name.trim(), emoji, creatorName, members: mappedMembers })
      if (membersError) setCreateError(membersError)
      router.push(`/groups/${id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setCreating(false)
    }
  }

  function toggleSuggested(p: ProfileSnippet) {
    const alreadyIn = members.some(m => m.type === 'user' && m.profile.id === p.id)
    if (alreadyIn) {
      setMembers(prev => prev.filter(m => !(m.type === 'user' && m.profile.id === p.id)))
    } else {
      setMembers(prev => [...prev, { type: 'user', profile: p }])
    }
  }

  function handleAddGuest(guestName: string) {
    const trimmed = guestName.trim()
    if (!trimmed) return
    setMembers(prev => [...prev, { type: 'guest', name: trimmed, tempId: `guest-${Date.now()}` }])
    setMobileQuery('')
  }

  const totalMembers = members.length + 1
  const listProfiles = mobileQueryDebounced.length >= 2 ? searchResults : recents
  const sectionLabel = mobileQueryDebounced.length >= 2 ? 'Results' : 'Suggested'
  const showList = listProfiles.length > 0 || mobileQuery.trim().length > 0 || (mobileQueryDebounced.length >= 2 && !isSearchLoading)

  // ── Mobile layout ────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: T.bg, fontFamily: F, position: 'relative',
      }}>

        {/* Top bar */}
        <header style={{ padding: '14px 20px 6px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/groups')}
            style={{
              width: 36, height: 36, borderRadius: 10, background: T.surface,
              border: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: T.shadowSm,
            }}
          >
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
              <path d="M7 1L1 6.5L7 12" stroke={T.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: T.ink, fontFamily: FH }}>New Group</span>
        </header>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 140 }}>

          {/* Group header card */}
          <div style={{ padding: '10px 16px 14px' }}>
            <div ref={emojiPickerRef} style={{ position: 'relative' }}>
              <div style={{
                background: T.surface, borderRadius: 20, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: T.shadowSm,
              }}>
                <button
                  onClick={() => setShowEmojiPicker(v => !v)}
                  style={{
                    width: 58, height: 58, borderRadius: 17, flexShrink: 0,
                    background: T.surfaceAlt, border: 0, cursor: 'pointer',
                    fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {emoji}
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 19, height: 19, borderRadius: '50%',
                    background: T.ink, color: T.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 0 2px ${T.surface}`,
                  }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M7 1.5l1.5 1.5-5.5 5.5H1.5V7L7 1.5z" stroke={T.bg} strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                <input
                  ref={nameInputRef}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleCreate() }}
                  placeholder="Group name"
                  style={{
                    flex: 1, fontFamily: FH, fontSize: 22, fontWeight: 700,
                    letterSpacing: -0.6, lineHeight: 1.1,
                    color: name ? T.ink : T.inkFaint,
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: 0, caretColor: T.sun,
                  }}
                />
              </div>

              {showEmojiPicker && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100,
                  background: T.surface, borderRadius: 16, boxShadow: T.shadowModal,
                  padding: 10, display: 'flex', flexWrap: 'wrap', gap: 4, width: 212,
                  border: `0.5px solid ${T.line}`,
                }}>
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                      style={{
                        width: 42, height: 42, borderRadius: 11, fontSize: 20,
                        background: emoji === e ? T.surfaceAlt : 'transparent',
                        border: `2px solid ${emoji === e ? T.lineStrong : 'transparent'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected strip */}
          {members.length > 0 && (
            <div style={{ padding: '0 16px 14px' }}>
              <div style={{
                display: 'flex', gap: 10, overflowX: 'auto',
                scrollbarWidth: 'none', padding: '2px 0 4px',
              }}>
                {members.map((entry, i) => {
                  const p = entry.type === 'user'
                    ? entry.profile
                    : {
                        id: entry.tempId,
                        name: entry.name,
                        display_name: null as string | null,
                        avatar_url: null as string | null,
                        add_code: null as string | null,
                        handle: null as string | null,
                      }
                  const firstName = (p.display_name ?? p.name).split(' ')[0]
                  const key = entry.type === 'guest' ? entry.tempId : entry.profile.id
                  return (
                    <div key={key} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 5, flexShrink: 0, width: 54,
                    }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar profile={p} slot={(i + 1) % 4 as 0 | 1 | 2 | 3} size={46} />
                        <button
                          onClick={() => setMembers(prev => prev.filter((_, j) => j !== i))}
                          style={{
                            position: 'absolute', top: -3, right: -3,
                            width: 19, height: 19, borderRadius: '50%',
                            background: T.ink, color: T.bg,
                            border: `2px solid ${T.bg}`,
                            cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 8 8">
                            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, fontFamily: F,
                        color: T.inkMuted, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 52, textAlign: 'center',
                      }}>
                        {firstName}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: T.surface, borderRadius: 14, padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              border: `1.5px solid ${searchFocused ? T.sun : T.line}`,
              transition: 'border-color 0.15s',
              boxShadow: T.shadowSm,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <circle cx="6.5" cy="6.5" r="4.5" stroke={T.ink} strokeWidth="1.5" />
                <path d="M11 11l3.5 3.5" stroke={T.ink} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={mobileQuery}
                onChange={e => setMobileQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Add people…"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 15, fontFamily: F, color: T.ink,
                }}
              />
              {mobileQuery.length > 0 && (
                <button
                  onClick={() => setMobileQuery('')}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: T.surfaceAlt, border: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke={T.inkMuted} strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Section label */}
          {(recents.length > 0 || mobileQueryDebounced.length >= 2) && (
            <div style={{
              padding: '0 20px 10px',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              textTransform: 'uppercase' as const, color: T.inkMuted,
            }}>
              {sectionLabel}
            </div>
          )}

          {/* List card */}
          {showList && (
            <div style={{ padding: '0 16px' }}>
              <div style={{
                background: T.surface, borderRadius: 18, overflow: 'hidden',
                border: `0.5px solid ${T.line}`,
              }}>
                {isSearchLoading && mobileQueryDebounced.length >= 2 && (
                  <div style={{ padding: '14px 16px', fontSize: 14, color: T.inkFaint }}>
                    Searching…
                  </div>
                )}

                {!isSearchLoading && listProfiles.length > 0 && (
                  <SuggestedMembers
                    profiles={listProfiles}
                    selected={members}
                    onSelect={toggleSuggested}
                    variant="list"
                  />
                )}

                {mobileQueryDebounced.length >= 2 && !isSearchLoading && listProfiles.length === 0 && (
                  <div style={{ padding: '14px 16px', fontSize: 14, color: T.inkFaint }}>
                    No Tally users found
                  </div>
                )}

                {mobileQuery.trim().length > 0 && (
                  <button
                    onClick={() => handleAddGuest(mobileQuery)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px', background: T.sunSoft, border: 'none',
                      borderTop: `0.5px solid ${T.line}`,
                      cursor: 'pointer', fontFamily: F, textAlign: 'left' as const,
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      border: `1.5px dashed ${T.lineStrong}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, color: T.inkMuted, background: T.bg,
                    }}>
                      +
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.sunInk }}>
                        Add "{mobileQuery.trim()}" as guest
                      </div>
                      <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>
                        No Tally account needed
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Floating CTA */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          padding: '36px 16px 24px',
          background: `linear-gradient(to bottom, transparent 0%, ${T.bg} 38%)`,
          pointerEvents: 'none',
        }}>
          {createError && (
            <div style={{
              padding: '0 4px 10px', fontSize: 12,
              color: T.coralInk, display: 'flex', alignItems: 'center', gap: 6,
              pointerEvents: 'auto',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.coral, flexShrink: 0 }} />
              {createError}
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            style={{
              pointerEvents: 'auto',
              width: '100%', padding: '16px', borderRadius: 18, border: 0,
              background: name.trim() ? T.sun : T.surfaceAlt,
              color: name.trim() ? T.sunInk : T.inkMuted,
              cursor: name.trim() && !creating ? 'pointer' : 'default',
              fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.3,
              boxShadow: name.trim() ? T.shadowFab : 'none',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            {creating ? 'Creating…' : `Create group · ${totalMembers} ${totalMembers === 1 ? 'member' : 'members'}`}
          </button>
        </div>

      </div>
    )
  }

  // ── Desktop layout ────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes tally-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: T.bg, fontFamily: F }}>

        {/* Breadcrumb */}
        <header style={{ padding: '20px 32px 0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: T.inkMuted }}>
            <span onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>Home</span>
            <Chevron />
            <span onClick={() => router.push('/groups')} style={{ cursor: 'pointer' }}>Groups</span>
            <Chevron />
            <span style={{ color: T.ink, fontWeight: 700 }}>New</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <kbd style={{ padding: '3px 7px', borderRadius: 5, background: T.surface, color: T.ink, fontFamily: FMONO, fontWeight: 700, fontSize: 10, border: `0.5px solid ${T.line}` }}>
              esc
            </kbd>
            <span style={{ fontSize: 11, color: T.inkMuted }}>to cancel</span>
          </div>
        </header>

        {/* Body */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 32px',
          display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28, alignItems: 'start',
        }}>

          {/* Left — form */}
          <section>
            {/* Emoji + name row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 28 }}>

              {/* Emoji button */}
              <div ref={emojiPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => setShowEmojiPicker(v => !v)}
                  style={{
                    width: 96, height: 96, borderRadius: 26, flexShrink: 0,
                    background: T.surface, border: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 46, position: 'relative',
                    boxShadow: `inset 0 0 0 1px ${T.lineStrong}`,
                  }}
                >
                  {emoji}
                  <span style={{
                    position: 'absolute', bottom: -3, right: -3,
                    width: 26, height: 26, borderRadius: '50%',
                    background: T.ink, color: T.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 0 3px ${T.bg}`,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                      <path d="M9 2l3 3-7 7H2v-3l7-7z" stroke={T.bg} strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                {showEmojiPicker && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100,
                    background: T.surface, borderRadius: 16, boxShadow: T.shadowFloat,
                    padding: 10, display: 'flex', flexWrap: 'wrap', gap: 4, width: 208,
                  }}>
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                        style={{
                          width: 40, height: 40, borderRadius: 10, fontSize: 20,
                          background: emoji === e ? T.surfaceAlt : 'transparent',
                          border: `2px solid ${emoji === e ? T.lineStrong : 'transparent'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
                <div style={labelStyle}>Group name</div>
                <input
                  ref={nameInputRef}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleCreate() }}
                  placeholder="Name your group"
                  style={{
                    width: '100%', marginTop: 6,
                    fontFamily: FH, fontSize: 40, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.02,
                    color: name ? T.ink : T.inkFaint,
                    background: 'transparent', border: 'none', outline: 'none', padding: 0,
                    caretColor: T.sun,
                  }}
                />
              </div>
            </div>

            {/* Suggested strip */}
            {recents.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...labelStyle, marginBottom: 10 }}>Suggested</div>
                <SuggestedMembers
                  profiles={recents}
                  selected={members}
                  onSelect={toggleSuggested}
                  variant="strip"
                />
              </div>
            )}

            {/* Members */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={labelStyle}>Members</div>
              <div style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600 }}>
                name · @handle · 8-char code
              </div>
            </div>
            <MemberCombobox
              value={members}
              onChange={setMembers}
              placeholder="Add by name…"
            />

            {/* Members card */}
            <div style={{
              background: T.surface, borderRadius: 18,
              boxShadow: T.shadowSm, overflow: 'hidden', marginTop: 14,
            }}>
              <div style={{
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `0.5px solid ${T.line}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>
                  <span>In this group</span>
                  <span style={{
                    fontFamily: FMONO, fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                    background: T.bg, color: T.inkMuted,
                  }}>{totalMembers}</span>
                </div>
              </div>

              {profile && (
                <MemberRow
                  displayName={profile.display_name ?? profile.name}
                  handle={profile.handle}
                  avatarProfile={profile}
                  slot={0}
                  isYou
                  isLast={members.length === 0}
                />
              )}

              {members.map((entry, i) => {
                const isLast = i === members.length - 1
                if (entry.type === 'user') {
                  return (
                    <MemberRow
                      key={entry.profile.id}
                      displayName={entry.profile.display_name ?? entry.profile.name}
                      handle={entry.profile.handle}
                      avatarProfile={entry.profile}
                      slot={(i + 1) % 4 as 0 | 1 | 2 | 3}
                      isLast={isLast}
                      onRemove={() => setMembers(prev => prev.filter((_, j) => j !== i))}
                    />
                  )
                }
                return (
                  <MemberRow
                    key={entry.tempId}
                    displayName={entry.name}
                    avatarProfile={avatarProfile({ name: entry.name })}
                    slot={(i + 1) % 4 as 0 | 1 | 2 | 3}
                    isLast={isLast}
                    onRemove={() => setMembers(prev => prev.filter((_, j) => j !== i))}
                  />
                )
              })}
            </div>

            {members.length > 0 && (
              <div style={{
                marginTop: 10, padding: '0 4px',
                fontSize: 11.5, color: T.inkMuted, lineHeight: 1.55,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="11" height="11" viewBox="0 0 12 12">
                  <circle cx="6" cy="6" r="5" stroke={T.inkFaint} strokeWidth="1" fill="none" />
                  <path d="M6 3.5v3M6 8.2v.4" stroke={T.inkFaint} strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Found through search? They'll get a notification — they can accept or decline.
              </div>
            )}
          </section>

          {/* Right — preview */}
          <aside>
            <div style={{ ...labelStyle, marginBottom: 12 }}>Preview</div>
            <div style={{ background: T.surface, borderRadius: 18, boxShadow: T.shadowSm, padding: '14px 14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {emoji}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, letterSpacing: -0.3, fontFamily: FH,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: name ? T.ink : T.inkFaint,
                  }}>
                    {name || 'Untitled group'}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2, fontFamily: FMONO }}>
                    0 expenses · just now
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${T.line}` }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {profile && (
                    <div style={{ zIndex: 10 }}>
                      <Avatar profile={profile} slot={0} size={22} isYou />
                    </div>
                  )}
                  {members.slice(0, 4).map((entry, i) => (
                      <div key={i} style={{ marginLeft: -7, zIndex: 9 - i }}>
                        <Avatar
                          profile={entry.type === 'guest'
                            ? avatarProfile({ name: entry.name })
                            : avatarProfile({ name: entry.profile.name, profile: entry.profile })}
                          slot={(i + 1) % 4 as 0 | 1 | 2 | 3}
                          size={22}
                        />
                      </div>
                  ))}
                  {members.length > 4 && (
                    <div style={{
                      marginLeft: -7, width: 22, height: 22, borderRadius: '50%',
                      background: T.surfaceAlt, border: `2px solid ${T.surface}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: T.inkMuted,
                    }}>
                      +{members.length - 4}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: T.inkMuted, fontWeight: 600 }}>
                  {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </aside>
        </div>

        {/* Sticky footer */}
        <footer style={{
          flexShrink: 0, padding: '14px 32px',
          borderTop: `0.5px solid ${T.line}`, background: T.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {createError ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.coral, flexShrink: 0 }} />
                <span style={{ color: T.coralInk }}>{createError}</span>
              </>
            ) : (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.mint, flexShrink: 0 }} />
                <span style={{ color: T.inkMuted }}>Nothing is created until you click below.</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => router.push('/groups')}
              style={{
                padding: '12px 18px', borderRadius: 12, background: 'transparent',
                color: T.inkMuted, border: 0, cursor: 'pointer', font: 'inherit',
                fontSize: 14, fontWeight: 700,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              style={{
                padding: '12px 22px', borderRadius: 12, border: 0,
                background: name.trim() ? T.sun : T.surfaceAlt,
                color: name.trim() ? T.sunInk : T.inkMuted,
                cursor: name.trim() && !creating ? 'pointer' : 'default',
                font: 'inherit', fontFamily: FH, fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
                boxShadow: name.trim() ? '0 6px 16px rgba(242,192,74,0.32)' : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
            >
              {creating ? 'Creating…' : 'Create group'}
              {!creating && (
                <span style={{
                  padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(31,26,20,0.10)',
                  fontFamily: FMONO, fontSize: 11,
                }}>
                  {totalMembers}
                </span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}
