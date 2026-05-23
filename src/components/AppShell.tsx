'use client'

import { TabBar } from './TabBar'
import { ModeSheet } from './ModeSheet'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 90 }}>
      {children}
      <TabBar />
      <ModeSheet />
    </div>
  )
}
