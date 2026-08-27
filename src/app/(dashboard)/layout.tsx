'use client'

import { usePathname } from 'next/navigation'
import { F } from '@/design/tokens'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { AddExpenseGroupPicker } from '@/components/AddExpenseGroupPicker'
import { DockedTabBar } from '@/components/DockedTabBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // The full-screen add-expense route reads as its own focused screen, like a
  // modal would — no persistent tab bar underneath it.
  const hideTabBar = /^\/groups\/[^/]+\/add$/.test(pathname)

  return (
    <>
      <div className="dashboard-layout" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--tally-page-bg)', fontFamily: F }}>
        <aside className="dashboard-sidebar">
          <Sidebar />
        </aside>
        <div
          className={hideTabBar ? 'dashboard-main dashboard-main--no-tabbar' : 'dashboard-main'}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
      {/* Outside the 100dvh overflow:hidden shell so iOS Safari can't clip it. */}
      {!hideTabBar && (
        <div className="dashboard-mobile-nav">
          <DockedTabBar />
        </div>
      )}
      <AddExpenseGroupPicker />
    </>
  )
}
