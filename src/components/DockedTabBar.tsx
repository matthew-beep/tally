'use client'

import { useRouter, usePathname } from 'next/navigation'
import { T, F } from '@/design/tokens'
import { WebNavIcon } from '@/components/nav/WebNavIcon'
import { NAV_TABS, pathnameToTab, type TabId } from '@/components/nav/navTabs'
import { useUIStore } from '@/store/ui'

/**
 * Alternate mobile nav — docked bar with an elevated center "Add" action,
 * compared against the floating-pill `TabBar` from the "Header & Sidebar
 * Variants" design exploration. Swap into `(dashboard)/layout.tsx` in place
 * of `<TabBar />` to try it; `TabBar` is left untouched so reverting is a
 * one-line change.
 */
export function DockedTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const setFabOpen = useUIStore(s => s.setFabOpen)
  const active = pathnameToTab(pathname)

  const left = NAV_TABS.slice(0, 2)
  const right = NAV_TABS.slice(2)

  function Tab({ id, label, href }: { id: TabId; label: string; href: string }) {
    const on = id === active
    const ink = on ? T.ink : T.inkFaint
    return (
      <button
        type="button"
        className="wntap"
        onClick={() => router.push(href)}
        title={label}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: F,
          color: ink,
          padding: '2px 0',
        }}
      >
        <WebNavIcon name={id} color={ink} fill={on} size={20} />
        <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, letterSpacing: 0.1 }}>{label}</span>
      </button>
    )
  }

  return (
    <div
      style={{
        flexShrink: 0,
        position: 'relative',
        height: 92,
        background: T.surface,
        borderTop: `1px solid ${T.line}`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.04)',
      }}
    >
      <button
        type="button"
        onClick={() => setFabOpen(true)}
        title="Add expense"
        style={{
          position: 'absolute',
          left: '50%',
          top: -22,
          transform: 'translateX(-50%)',
          zIndex: 3,
          width: 60,
          height: 60,
          borderRadius: T.r.pill,
          border: `4px solid ${T.surface}`,
          cursor: 'pointer',
          background: T.sun,
          color: T.sunOn,
          boxShadow: T.shadowFab,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 16 16">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 8px 0', height: 74 }}>
        {left.map(tab => (
          <Tab key={tab.id} id={tab.id} label={tab.label} href={tab.href} />
        ))}
        <div style={{ width: 64, flexShrink: 0 }} />
        {right.map(tab => (
          <Tab key={tab.id} id={tab.id} label={tab.label} href={tab.href} />
        ))}
      </div>
    </div>
  )
}
