'use client'

import { useRouter, usePathname, useParams } from 'next/navigation'
import { T, F } from '@/design/tokens'
import { WebNavIcon } from '@/components/nav/WebNavIcon'
import { NAV_TABS, pathnameToTab, type TabId } from '@/components/nav/navTabs'
import { useUIStore } from '@/store/ui'

/**
 * Mobile nav — "D2 · Circle" from the claude.ai/design splitter project
 * (`Floating Navbar - D Raised.html` → `NrvCircle` in
 * `nav-raised-variations.jsx`). A floating pill inset from the screen edges
 * with the tabs split 2 | + | 2 around a round sun key that breaks the bar's
 * top edge.
 *
 * Replaces `DockedTabBar`, the edge-to-edge opaque bar. The move to floating
 * is what retires the "mobile navbar bottom colour gap" bug: that seam only
 * existed because the docked bar painted `--tally-surface` against a
 * `--tally-page-bg` page, so iOS Safari's stale `100dvh` exposed a colour
 * change under it. Everything around this pill is already page bg.
 *
 * Positioning and the scroll clearance it needs live in `dashboard.css`
 * (`.dashboard-mobile-nav`, `--tally-nav-clearance`) — this component only
 * draws the pill.
 */

const BAR_RADIUS = 27
const BAR_PAD = 8
const TAB_HEIGHT = 46
/** Width reserved between the two tab pairs for the raised key. */
const KEY_SLOT = 72
const KEY_SIZE = 60
/** How far the key breaks above the bar's top edge. */
const KEY_RISE = 26
/** Ring of bar colour around the key, cutting it out of the bar's edge. */
const KEY_RING = 6

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
        position: 'relative',
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
      <div style={{ width: KEY_SLOT, flexShrink: 0 }} />
      {right.map(tab => (
        <Tab key={tab.id} id={tab.id} label={tab.label} href={tab.href} />
      ))}

      <button
        type="button"
        className="wntap"
        onClick={onAddExpense}
        title="Add expense"
        aria-label="Add expense"
        style={{
          position: 'absolute',
          top: -KEY_RISE,
          // Centred with `left` rather than a translate, so `.wntap:active`'s
          // translateY press has the transform to itself.
          left: `calc(50% - ${KEY_SIZE / 2}px)`,
          width: KEY_SIZE,
          height: KEY_SIZE,
          borderRadius: T.r.pill,
          border: 0,
          cursor: 'pointer',
          background: `linear-gradient(180deg, ${T.sunHi} 0%, ${T.sun} 55%, ${T.sunLo} 100%)`,
          color: T.sunOn,
          // Ring last so it paints under the sun shadow, which then tints its
          // outer edge — the key reads as cut out of the bar, not stuck on it.
          boxShadow: `${T.shadowSun}, 0 0 0 ${KEY_RING}px ${T.navVeil}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
