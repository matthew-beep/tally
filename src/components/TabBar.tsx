'use client'

import { T, FH, F } from '@/design/tokens'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/store/ui'

const TABS = [
  { href: '/',          label: 'Home',     icon: '⌂' },
  { href: '/groups',    label: 'Groups',   icon: '⊞' },
  { href: '/activity',  label: 'Activity', icon: '◷' },
  { href: '/me',        label: 'Me',       icon: '○' },
]

export function TabBar() {
  const pathname = usePathname()
  const setFabOpen = useUIStore(s => s.setFabOpen)

  return (
    /* Outer wrapper: centers the pill + FAB row above the safe area */
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Floating pill — the four nav tabs */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: T.surface,
          borderRadius: T.r.xl,
          padding: '8px 10px',
          boxShadow: T.shadowFloat,
          pointerEvents: 'auto',
        }}
      >
        {TABS.map(tab => {
          const active = tab.href === '/'
            ? pathname === '/'
            : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '8px 14px',
                borderRadius: T.r.tab,
                background: active ? T.bg : 'transparent',
                color: active ? T.ink : T.inkFaint,
                textDecoration: 'none',
                transition: 'color 0.1s',
              }}
            >
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: F }}>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* FAB — sits outside the pill */}
      <button
        onClick={() => setFabOpen(true)}
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          background: T.sun,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: T.sunInk,
          fontFamily: FH,
          fontWeight: 700,
          /* Glow + ring gap per §8 */
          boxShadow: `${T.shadowFab}, 0 0 0 4px ${T.bg}`,
          pointerEvents: 'auto',
          flexShrink: 0,
        }}
        aria-label="Add expense"
      >
        +
      </button>
    </div>
  )
}
