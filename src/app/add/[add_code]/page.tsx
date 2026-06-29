'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useProfileByAddCode } from '@/queries/useProfile'
import { useGroups, useProfileGroups } from '@/queries/useGroups'

export default function AddByCodePage() {
  const params = useParams()
  const code = (params.add_code as string).toUpperCase()
  const router = useRouter()

  const { data: target, isLoading: loadingTarget } = useProfileByAddCode(code)
  const { data: myGroups = [], isLoading: loadingGroups } = useGroups()
  const { data: targetGroupIds = [] } = useProfileGroups(target?.id)

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const eligible = myGroups.filter(g => !targetGroupIds.includes(g.id))
  const effectiveSelected = selectedGroupId ?? eligible[0]?.id ?? null
  const selectedGroup = myGroups.find(g => g.id === effectiveSelected)
  const targetName = target ? (target.display_name ?? target.name) : ''

  async function handleAdd() {
    if (!target || !effectiveSelected) return
    setAdding(true)
    try {
      const res = await fetch('/api/groups/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: effectiveSelected,
          members: [{ type: 'user', profileId: target.id, name: target.display_name ?? target.name }],
        }),
      })
      if (!res.ok) throw new Error('Failed to add member')
      router.push(`/groups/${effectiveSelected}`)
    } finally {
      setAdding(false)
    }
  }

  if (loadingTarget || loadingGroups) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: T.inkMuted, fontFamily: F }}>Loading…</div>
      </div>
    )
  }

  if (!target) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', fontFamily: F }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 6 }}>User not found</div>
          <div style={{ fontSize: 13, color: T.inkMuted }}>No user has add code <span style={{ fontFamily: FMONO, fontWeight: 700 }}>{code}</span>.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, color: T.ink, fontFamily: F, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10, background: T.sun, color: T.sunInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, fontFamily: FH,
          }}>T</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5, fontFamily: FH }}>tally</div>
        </div>
        <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: FMONO }}>
          tally.app/add/<b style={{ color: T.ink }}>{code}</b>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.15fr', minHeight: 0 }}>
        {/* Left: person card */}
        <div style={{
          padding: '48px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          borderRight: `1px solid ${T.line}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 16 }}>
            You're adding
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 24 }}>
            <Avatar profile={target} slot={1} size={88} />
            <div>
              <div style={{ fontFamily: FH, fontSize: 38, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.05 }}>
                {targetName}
              </div>
            </div>
          </div>
          {target.add_code && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '8px 16px', borderRadius: T.r.pill, background: T.surface,
              alignSelf: 'flex-start', boxShadow: T.shadowSm,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.mint, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 600 }}>Verified add code</span>
              <span style={{ color: T.line }}>·</span>
              <span style={{ fontFamily: FMONO, letterSpacing: 1.4, fontSize: 12, fontWeight: 700 }}>{target.add_code}</span>
            </div>
          )}
        </div>

        {/* Right: group selection */}
        <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>
            Add to which group?
          </div>
          <div style={{ fontSize: 13, color: T.inkMuted, marginBottom: 20 }}>
            Pick one of yours, or start something new.
          </div>

          {eligible.length === 0 && myGroups.length > 0 ? (
            <div style={{ fontSize: 13, color: T.inkMuted, padding: '20px 0' }}>
              {targetName.split(' ')[0]} is already in all your groups.
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div style={{ background: T.surface, borderRadius: 18, overflow: 'hidden', boxShadow: T.shadowSm }}>
                {eligible.map((g, i) => {
                  const sel = g.id === effectiveSelected
                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', textAlign: 'left', font: 'inherit', color: T.ink,
                        background: sel ? T.sunSoft : 'transparent',
                        border: 0, borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                        background: sel ? T.surface : T.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                      }}>{g.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{g.name}</div>
                      </div>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        border: sel ? 'none' : `1.5px solid ${T.lineStrong}`,
                        background: sel ? T.ink : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke={T.bg} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </button>
                  )
                })}
                <button
                  onClick={() => router.push('/groups/new')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', textAlign: 'left', font: 'inherit', color: T.ink,
                    background: 'transparent', border: 0,
                    borderTop: eligible.length > 0 ? `0.5px solid ${T.line}` : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                    border: `1.5px dashed ${T.lineStrong}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.inkMuted, fontSize: 22, fontFamily: FH, fontWeight: 500,
                  }}>+</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Start a new group</div>
                    <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
                      {targetName.split(' ')[0]} will be the first member
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => router.push('/groups')}
              style={{ padding: '14px 18px', borderRadius: 14, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700 }}
            >
              Not now
            </button>
            {eligible.length > 0 && selectedGroup && (
              <button
                onClick={handleAdd}
                disabled={adding}
                style={{
                  flex: 1, padding: '14px 18px', borderRadius: 14,
                  background: T.sun, color: T.sunInk, border: 0, cursor: 'pointer',
                  font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 600, letterSpacing: -0.2,
                  boxShadow: '0 8px 20px rgba(242,192,74,0.30)',
                  opacity: adding ? 0.7 : 1,
                }}
              >
                {adding ? 'Adding…' : `Add ${targetName.split(' ')[0]} to ${selectedGroup.name}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
