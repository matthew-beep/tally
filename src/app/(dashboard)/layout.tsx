'use client'

import { usePathname } from 'next/navigation'
import { F } from '@/design/tokens'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { AddExpenseGroupPicker } from '@/components/AddExpenseGroupPicker'
import { FloatingTabBar } from '@/components/FloatingTabBar'

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
          className="dashboard-main"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
      {/* Outside the 100dvh overflow:hidden shell, and fixed to the real
          viewport rather than to that shell — same pin as Vaul's sheet, which
          is the one thing on mobile that has always sat flush to the bottom.
          Scroll clearance comes from `--tally-nav-clearance`, not from flow. */}
      {!hideTabBar && (
        <>
          <div className="dashboard-mobile-nav-fade" />
          <div className="dashboard-mobile-nav">
            <FloatingTabBar />
          </div>
        </>
      )}
      <AddExpenseGroupPicker />
    </>
  )
}
