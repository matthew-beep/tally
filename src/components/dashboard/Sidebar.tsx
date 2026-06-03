'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { T, F, FH } from '@/design/tokens'
import { useGroups } from '@/queries/useGroups'
import { useUIStore } from '@/store/ui'
import { SliderPill } from '@/components/nav/SliderPill'
import { useSlider } from '@/components/nav/useSlider'
import { WebNavIcon, type WebNavIconName } from '@/components/nav/WebNavIcon'

const PRIMARY_NAV: { id: string; label: string; icon: WebNavIconName; href: string; match: (p: string) => boolean }[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/', match: p => p === '/' },
  { id: 'groups', label: 'Groups', icon: 'groups', href: '/groups', match: p => p === '/groups' || p === '/groups/new' },
  { id: 'activity', label: 'Activity', icon: 'activity', href: '/activity', match: p => p.startsWith('/activity') },
  { id: 'me', label: 'Me', icon: 'me', href: '/me', match: p => p.startsWith('/me') },
]

function getPrimaryActive(pathname: string): string | null {
  const item = PRIMARY_NAV.find(n => n.match(pathname))
  return item?.id ?? null
}

function SidebarNavItem({
  id,
  label,
  icon,
  href,
  active,
  setRef,
}: {
  id: string
  label: string
  icon: WebNavIconName
  href: string
  active: boolean
  setRef: (id: string) => (el: HTMLElement | null) => void
}) {
  const ink = active ? T.sunInk : T.inkFaint
  return (
    <div ref={setRef(id)}>
      <Link
        href={href}
        className="wntap"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '10px 12px',
          borderRadius: 12,
          color: ink,
          fontSize: 13.5,
          fontWeight: active ? 700 : 600,
          textDecoration: 'none',
        }}
      >
        <WebNavIcon name={icon} color={ink} fill={active} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </Link>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: groups = [] } = useGroups()
  const setNewGroupOpen = useUIStore(s => s.setNewGroupOpen)

  const activeId = getPrimaryActive(pathname) ?? ''
  const { containerRef, setRef, box } = useSlider(activeId)

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        width: 232,
        flexShrink: 0,
        height: '100dvh',
        boxSizing: 'border-box',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        background: T.surface,
        borderRight: `0.5px solid ${T.line}`,
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '2px 10px 18px',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: T.sun,
            color: T.sunInk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 15,
            fontFamily: FH,
            letterSpacing: -0.5,
            flexShrink: 0,
          }}
        >
          T
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.6, fontFamily: FH, color: T.ink }}>
          tally
        </span>
      </Link>

      <div
        ref={containerRef}
        style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <SliderPill variant="pill" box={activeId ? box : null} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {PRIMARY_NAV.map(item => (
            <SidebarNavItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              href={item.href}
              active={item.id === activeId}
              setRef={setRef}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: T.inkFaint,
            padding: '16px 12px 7px',
          }}
        >
          Groups
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', flex: 1, minHeight: 0 }}>
          {groups.length === 0 && (
            <div style={{ fontSize: 12, color: T.inkFaint, padding: '6px 12px' }}>No groups yet</div>
          )}
          {groups.map(group => {
            const active =
              pathname === `/groups/${group.id}` || pathname.startsWith(`/groups/${group.id}/`)
            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="wntap"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 12px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  color: active ? T.sunInk : T.ink,
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 600,
                  background: active ? T.sunSoft : 'transparent',
                  transition: 'background .15s ease, color .15s ease',
                }}
              >
                <span style={{ fontSize: 17, width: 19, textAlign: 'center', flexShrink: 0 }}>{group.emoji}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setNewGroupOpen(true)}
        className="wntap"
        style={{
          width: '100%',
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          background: 'transparent',
          border: `1.5px dashed ${T.lineStrong}`,
          color: T.inkMuted,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: F,
        }}
      >
        <span>＋</span> New group
      </button>
    </aside>
  )
}
