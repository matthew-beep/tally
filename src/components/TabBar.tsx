'use client'

import { useRouter, usePathname } from 'next/navigation'
import { T, F } from '@/design/tokens'
import { SliderPill } from '@/components/nav/SliderPill'
import { useSlider } from '@/components/nav/useSlider'
import { WebNavIcon, type WebNavIconName } from '@/components/nav/WebNavIcon'
import { WebNavBadge } from '@/components/nav/WebNavBadge'

const NAV_TABS = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'groups', label: 'Groups', href: '/groups' },
  { id: 'activity', label: 'Activity', href: '/activity' },
  { id: 'me', label: 'Me', href: '/me' },
] as const

type TabId = (typeof NAV_TABS)[number]['id']

const NAV_BADGES: Partial<Record<TabId, 'dot' | number>> = {}

function pathnameToTab(pathname: string): TabId {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/groups')) return 'groups'
  if (pathname.startsWith('/activity')) return 'activity'
  if (pathname.startsWith('/me')) return 'me'
  return 'home'
}

function FloatingNav({
  active,
  onSelect,
}: {
  active: TabId
  onSelect: (id: TabId) => void
}) {
  const { containerRef, setRef, box } = useSlider(active)
  const glow = 'rgba(242,192,74,0.4)'

  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 999,
        padding: 7,
        boxShadow: T.shadowFloat,
        border: `0.5px solid ${T.line}`,
        width: '100%',
      }}
    >
      <div ref={containerRef} style={{ position: 'relative', display: 'flex', width: '100%' }}>
        <SliderPill variant="float" box={box} glow={glow} />
        {NAV_TABS.map(tab => {
          const on = tab.id === active
          const ink = on ? T.sunOn : T.inkMuted
          const badge = NAV_BADGES[tab.id]
          return (
            <button
              key={tab.id}
              ref={setRef(tab.id)}
              type="button"
              className="wntap"
              onClick={() => onSelect(tab.id)}
              title={tab.label}
              style={{
                flex: 1,
                position: 'relative',
                zIndex: 1,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: F,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                height: 52,
                borderRadius: 999,
                color: ink,
              }}
            >
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <WebNavIcon name={tab.id as WebNavIconName} color={ink} fill={on} size={20} />
                {badge === 'dot' && (
                  <span style={{ position: 'absolute', top: -2, right: -3 }}>
                    <WebNavBadge badge="dot" ring={on ? T.sunSoft : T.surface} />
                  </span>
                )}
              </span>
              <span style={{ fontSize: 10, fontWeight: on ? 700 : 600, color: ink, lineHeight: 1 }}>
                {tab.label}
              </span>
              {typeof badge === 'number' && (
                <WebNavBadge badge={badge} ring={on ? T.sunSoft : T.surface} />
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
  const active = pathnameToTab(pathname)

  function onSelect(id: TabId) {
    const tab = NAV_TABS.find(t => t.id === id)
    if (tab) router.push(tab.href)
  }

  return (
    <div style={{ padding: '10px 18px' }}>
      <FloatingNav active={active} onSelect={onSelect} />
    </div>
  )
}
