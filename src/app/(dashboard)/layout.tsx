'use client'

import { T, F } from '@/design/tokens'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { ModeSheet } from '@/components/ModeSheet'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: T.bg, fontFamily: F }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
      <ModeSheet />
    </div>
  )
}
