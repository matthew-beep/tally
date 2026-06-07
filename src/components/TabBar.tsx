'use client'

import { useRouter, usePathname } from 'next/navigation'
import { T, F } from '@/design/tokens'

const NAV_TABS = [
  { id: 'home',     label: 'Home',     href: '/' },
  { id: 'groups',   label: 'Groups',   href: '/groups' },
  { id: 'activity', label: 'Activity', href: '/activity' },
  { id: 'me',       label: 'Me',       href: '/me' },
] as const

type TabId = typeof NAV_TABS[number]['id']

const NAV_EASE = 'cubic-bezier(0.34,1.56,0.64,1)'

// Placeholder — wire up notification unread count per tab when poll is implemented
const NAV_BADGES: Record<TabId, number> = { home: 0, groups: 0, activity: 0, me: 0 }

function NavIcon({ name, color, fill, size, sw }: {
  name: TabId
  color: string
  fill: boolean
  size: number
  sw: number
}) {
  const svgStyle = {
    color,
    overflow: 'visible' as const,
  }
  const base = {
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const f = fill ? 'currentColor' : 'none'

  if (name === 'home') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={svgStyle}>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" fill={f} {...base} />
      <path d="M9 21V13h6v8" fill="none" {...base} />
    </svg>
  )

  if (name === 'groups') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={svgStyle}>
      <circle cx="9" cy="7" r="4" fill={f} {...base} />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" {...base} />
      <path d="M16 3.13a4 4 0 010 7.75" {...base} />
      <path d="M21 21v-2a4 4 0 00-3-3.87" {...base} />
    </svg>
  )

  if (name === 'activity') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={svgStyle}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" {...base} />
    </svg>
  )

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={svgStyle}>
      <circle cx="12" cy="7" r="4" fill={f} {...base} />
      <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" {...base} />
    </svg>
  )
}

function NavIconBadged({ name, color, fill, size, sw, badge, ring }: {
  name: TabId
  color: string
  fill: boolean
  size: number
  sw: number
  badge?: number
  ring: string
}) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <NavIcon name={name} color={color} fill={fill} size={size} sw={sw} />
      {!!badge && badge > 0 && (
        <div style={{
          position: 'absolute', top: -3, right: -4,
          minWidth: 14, height: 14, borderRadius: 99,
          background: T.coral, border: `2px solid ${ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 700, color: '#fff', fontFamily: F,
          padding: '0 2px', boxSizing: 'border-box',
        }}>
          {badge > 9 ? '9+' : badge}
        </div>
      )}
    </div>
  )
}

const SUB_CFG = {
  dot:     { shape: 'circle', fill: T.sunSoft,     ai: T.sunInk, ifill: true,  label: false },
  label:   { shape: 'pad',    fill: T.sunSoft,     ai: T.sunInk, ifill: true,  label: true  },
  solid:   { shape: 'circle', fill: T.sun,         ai: T.sunInk, ifill: true,  label: false },
  ink:     { shape: 'circle', fill: T.ink,         ai: T.bg,     ifill: false, label: false },
  outline: { shape: 'circle', fill: 'transparent', ai: T.ink,    ifill: false, label: false, brd: `1.5px solid ${T.sun}` },
  glow:    { shape: 'pad',    fill: T.sunSoft,     ai: T.sunInk, ifill: true,  label: true,  glow: true },
} as const

type Sub = keyof typeof SUB_CFG

function FloatingSliding({ active, onSelect, sub = 'label' }: {
  active: TabId
  onSelect: (id: TabId) => void
  sub?: Sub
}) {
  const idx = NAV_TABS.findIndex(x => x.id === active)
  const cfg = SUB_CFG[sub]
  const labelled = cfg.label
  const circle = cfg.shape === 'circle'
  const sunGlow = 'rgba(242,193,68,0.45)'

  return (
    <div style={{ background: T.surface, borderRadius: 26, padding: 9, boxShadow: T.shadowFloat, width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: labelled ? 52 : 46 }}>

        {/* sliding indicator */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${idx * 25}%`, width: '25%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: `left .38s ${NAV_EASE}`,
          pointerEvents: 'none',
        }}
        >
          <span style={{
            display: 'block',
            width: circle ? 46 : '84%',
            height: circle ? 46 : '100%',
            borderRadius: circle ? 999 : 15,
            background: cfg.fill,
            border: 'brd' in cfg ? cfg.brd : 'none',
            boxSizing: 'border-box',
            boxShadow: 'glow' in cfg && cfg.glow ? `0 5px 16px ${sunGlow}` : 'none',
          }} />
        </div>

        {NAV_TABS.map(tab => {
          const on = tab.id === active
          const c = on ? cfg.ai : T.inkFaint
          return (
            <button
              key={tab.id}
              className="ndtap"
              onClick={() => onSelect(tab.id)}
              title={tab.label}
              style={{
                position: 'relative', zIndex: 1, flex: 1,
                border: 0, background: 'transparent', cursor: 'pointer', fontFamily: F,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: labelled ? 3 : 0,
              }}
            >
              <NavIconBadged
                name={tab.id}
                color={c}
                fill={false}
                size={22}
                sw={2}
                badge={NAV_BADGES[tab.id]}
                ring={T.surface}
              />
              {labelled && (
                <span style={{ fontSize: 10, fontWeight: on ? 700 : 600, color: c }}>
                  {tab.label}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TabBar() {
  const router = useRouter()
  const pathname = usePathname()

  const active = ((): TabId => {
    if (pathname === '/') return 'home'
    if (pathname.startsWith('/groups')) return 'groups'
    if (pathname.startsWith('/activity')) return 'activity'
    if (pathname.startsWith('/me')) return 'me'
    return 'home'
  })()

  function onSelect(id: TabId) {
    router.push(NAV_TABS.find(t => t.id === id)!.href)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: 0,
      right: 0,
      padding: '0 18px',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        <FloatingSliding active={active} onSelect={onSelect} sub="label" />
      </div>
    </div>
  )
}
