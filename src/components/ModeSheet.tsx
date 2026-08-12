'use client'

import { T, FH, F } from '@/design/tokens'
import { useUIStore } from '@/store/ui'
import { useRouter } from 'next/navigation'
import { ModalOrSheet } from '@/components/modal'

export function ModeSheet() {
  const { fabOpen, setFabOpen, activeGroupId } = useUIStore()
  const router = useRouter()

  return (
    <ModalOrSheet open={fabOpen} onClose={() => setFabOpen(false)} title="What are you splitting?" maxWidth={400}>
      <div style={{ padding: '12px 24px 30px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FH, marginBottom: 16, textAlign: 'center' }}>
          What are you splitting?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Ink (primary) button — §8 */}
          <button
            onClick={() => {
              setFabOpen(false)
              router.push(activeGroupId ? `/groups/${activeGroupId}?add=1` : '/groups')
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
              router.push('/groups/new')
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
    </ModalOrSheet>
  )
}
