'use client'

import { T, F } from '@/design/tokens'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { ModeSheet } from '@/components/ModeSheet'
import { TabBar } from '@/components/TabBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--tally-page-bg)', fontFamily: F }}>
      <aside className="dashboard-sidebar">
        <Sidebar />
      </aside>
      <div
        className="dashboard-main"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
      <div className="dashboard-mobile-nav">
        <TabBar />
      </div>
      <ModeSheet />
    </div>
  )
}
