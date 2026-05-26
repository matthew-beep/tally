'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { MemberCombobox } from '@/components/MemberCombobox'
import type { MemberEntry } from '@/components/MemberCombobox'
import { useCreateGroup } from '@/queries/useGroups'
import { addMembersToGroup, createGuestProfile } from '@/queries/useMembers'
import { useCurrentProfile } from '@/queries/useProfile'

const EMOJIS = ['💸', '🏖️', '🍕', '✈️', '🏠', '🎉', '🛒', '🚗', '🍽️', '💪', '🎮', '❤️']

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

export default function NewGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💸')
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const createGroup = useCreateGroup()
  const { data: profile } = useCurrentProfile()

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

  async function handleCreate() {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const group = await createGroup.mutateAsync({ name: name.trim(), emoji })
      if (members.length > 0) {
        const ids: string[] = []
        for (const entry of members) {
          if (entry.type === 'user') ids.push(entry.profile.id)
          else ids.push(await createGuestProfile(entry.name))
        }
        await addMembersToGroup(group.id, ids)
      }
      router.push(`/groups/${group.id}`)
    } catch {
      setCreating(false)
    }
  }

  const totalMembers = members.length + 1

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

            {/* Members */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={labelStyle}>Members</div>
              <div style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600 }}>
                {members.length > 0 ? `${members.length} added` : 'search Tally or add as guest'}
              </div>
            </div>
            <MemberCombobox
              value={members}
              onChange={setMembers}
              placeholder="Add by name…"
            />
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
                {/* Avatar stack */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {profile && (
                    <div style={{ zIndex: 10 }}>
                      <Avatar profile={profile} slot={0} size={22} isYou />
                    </div>
                  )}
                  {members.slice(0, 4).map((entry, i) => {
                    const fakeProfile = entry.type === 'guest'
                      ? { id: entry.tempId, name: entry.name, display_name: null, avatar_url: null, add_code: null }
                      : entry.profile
                    return (
                      <div key={i} style={{ marginLeft: -7, zIndex: 9 - i }}>
                        <Avatar profile={fakeProfile} slot={(i + 1) % 4 as 0 | 1 | 2 | 3} size={22} />
                      </div>
                    )
                  })}
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
          <div style={{ fontSize: 12, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.mint, flexShrink: 0 }} />
            Nothing is created until you click below.
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
