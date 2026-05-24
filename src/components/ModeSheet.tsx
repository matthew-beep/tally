'use client'

import { T, FH, F } from '@/design/tokens'
import { useUIStore } from '@/store/ui'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ModeSheet() {
  const { fabOpen, setFabOpen, activeGroupId, setNewGroupOpen } = useUIStore()
  const router = useRouter()

  useEffect(() => {
    if (fabOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [fabOpen])

  if (!fabOpen) return null

  return (
    <>
      {/* Scrim — §13: rgba(15,12,8,0.18) */}
      <div
        onClick={() => setFabOpen(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,12,8,0.18)',
          zIndex: 200,
        }}
      />
      {/* Sheet — §13: borderTopRadius 28, padding 12 24 28, shadow -12px 40px */}
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: T.surface,
          borderRadius: `${T.r.sheet}px ${T.r.sheet}px 0 0`,
          padding: '12px 24px 40px',
          zIndex: 201,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
          animation: 'slide-up 0.25s ease-out',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 36, height: 4, borderRadius: 2,
            background: T.lineStrong,
            margin: '0 auto 24px',
          }}
        />
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, marginBottom: 16, textAlign: 'center' }}>
          What are you splitting?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Ink (primary) button — §8 */}
          <button
            onClick={() => {
              setFabOpen(false)
              router.push(activeGroupId ? `/groups/${activeGroupId}/add` : '/groups')
            }}
            style={{
              background: T.ink,
              color: T.bg,
              border: 'none',
              borderRadius: T.r.md,
              padding: '16px 20px',
              cursor: 'pointer',
              fontFamily: F,
              fontWeight: 700,
              fontSize: 15,
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <span>Add to a group</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>Log a shared expense in an existing group</span>
          </button>

          {/* Sun (brand) button — §8 */}
          <button
            onClick={() => {
              setFabOpen(false)
              setNewGroupOpen(true)
            }}
            style={{
              background: T.sun,
              color: T.sunInk,
              border: 'none',
              borderRadius: T.r.md,
              padding: '16px 20px',
              cursor: 'pointer',
              fontFamily: F,
              fontWeight: 700,
              fontSize: 15,
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              boxShadow: `0 4px 12px rgba(242,192,74,0.35)`,
            }}
          >
            <span>Split a bill</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>One-time split — creates a group automatically</span>
          </button>
        </div>
      </div>
    </>
  )
}
