'use client'

import { useRouter, usePathname, useParams } from 'next/navigation'
import { T, F } from '@/design/tokens'
import { WebNavIcon } from '@/components/nav/WebNavIcon'
import { NAV_TABS, pathnameToTab, type TabId } from '@/components/nav/navTabs'
import { useUIStore } from '@/store/ui'

/**
 * Mobile nav — floating pill inset from the screen edges with the tabs
 * split 2 | + | 2 around a round sun add key, centred and flush with the
 * tab row (no raised break above the bar).
 *
 * Replaces `DockedTabBar`, the edge-to-edge opaque bar. Pill fill is card
 * white (`--tally-nav-veil`); the wrapper in `dashboard.css` paints
 * `--tally-bg` under the float padding so iOS Safari can't show its own
 * canvas through the gap.
 *
 * Positioning and the scroll clearance it needs live in `dashboard.css`
 * (`.dashboard-mobile-nav`, `--tally-nav-clearance`) — this component only
 * draws the pill.
 */

const BAR_RADIUS = 27
const BAR_PAD = 8
const TAB_HEIGHT = 46
/** Sun key diameter — matches tab hit height so the whole row shares one midline. */
const KEY_SIZE = 46

export function FloatingTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const setFabOpen = useUIStore(s => s.setFabOpen)
  const active = pathnameToTab(pathname)

  // Already inside a group's context (/groups/[id], /groups/[id]/settings,
  // ...) — skip the "which group?" picker and go straight to its add-expense
  // route. `id` is only used by the groups route, so no other page's params
  // can collide here.
  const groupId = typeof params.id === 'string' ? params.id : undefined
  function onAddExpense() {
    if (groupId) { router.push(`/groups/${groupId}/add`); return }
    setFabOpen(true)
  }

  const left = NAV_TABS.slice(0, 2)
  const right = NAV_TABS.slice(2)

  function Tab({ id, label, href }: { id: TabId; label: string; href: string }) {
    const on = id === active
    const ink = on ? T.ink : T.inkMuted
    return (
      <button
        type="button"
        className="wntap"
        onClick={() => router.push(href)}
        title={label}
        style={{
          flex: 1,
          minWidth: 0,
          height: TAB_HEIGHT,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: F,
          color: ink,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <WebNavIcon name={id} color={ink} fill={on} size={20} sw={2} />
        <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 600, lineHeight: 1 }}>{label}</span>
      </button>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: BAR_PAD,
        borderRadius: BAR_RADIUS,
        background: T.navVeil,
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: `0.5px solid ${T.line}`,
        boxShadow: T.shadowNav,
        // The wrapper is pointer-events:none so taps land on the content
        // either side of the pill; the pill itself takes its own.
        pointerEvents: 'auto',
      }}
    >
      {left.map(tab => (
        <Tab key={tab.id} id={tab.id} label={tab.label} href={tab.href} />
      ))}
      <button
        type="button"
        className="wntap"
        onClick={onAddExpense}
        title="Add expense"
        aria-label="Add expense"
        style={{
          width: KEY_SIZE,
          height: KEY_SIZE,
          flexShrink: 0,
          margin: '0 4px',
          borderRadius: T.r.pill,
          border: 0,
          cursor: 'pointer',
          background: `linear-gradient(180deg, ${T.sunHi} 0%, ${T.sun} 55%, ${T.sunLo} 100%)`,
          color: T.sunOn,
          boxShadow: T.shadowSun,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      </button>
      {right.map(tab => (
        <Tab key={tab.id} id={tab.id} label={tab.label} href={tab.href} />
      ))}
    </div>
  )
}
