'use client'

import { FloatingTabBar } from '@/components/FloatingTabBar'
import { T, F } from '@/design/tokens'

// Scratch-only route to eyeball the floating nav without an authenticated
// session. Delete before committing.
export default function NavPreview() {
  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: 'var(--tally-page-bg)', fontFamily: F, display: 'flex', flexDirection: 'column' }}>
      <div className="page-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 16px' }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ background: T.surface, borderRadius: 14, padding: 18, marginBottom: 12, boxShadow: T.cardShadow, color: T.ink }}>
            <div style={{ fontWeight: 700 }}>Row {i + 1}</div>
            <div style={{ color: T.inkMuted, fontSize: 13, marginTop: 4 }}>Content that should fade out behind the pill</div>
          </div>
        ))}
      </div>
      <div className="dashboard-mobile-nav-fade" />
      <div className="dashboard-mobile-nav">
        <FloatingTabBar />
      </div>
    </div>
  )
}
