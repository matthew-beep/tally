'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, F, FH } from '@/design/tokens'
import { useGroups } from '@/queries/useGroups'
import { useCurrentProfile } from '@/queries/useProfile'
import { SliderPill } from '@/components/nav/SliderPill'
import { useSlider } from '@/components/nav/useSlider'
import { WebNavIcon, type WebNavIconName } from '@/components/nav/WebNavIcon'
import { SectionLabel } from '@/components/SectionLabel'
import { Avatar } from '@/components/Avatar'
import { ProfileMenuPopover } from '@/components/dashboard/ProfileMenuPopover'

// 'Me' is deliberately not a sidebar nav destination — identity/settings
// are reached via the profile menu at the bottom instead. See
// docs/features.md "Sidebar redesign" for what else this pass skipped.
const PRIMARY_NAV: { id: string; label: string; icon: WebNavIconName; href: string; match: (p: string) => boolean }[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/', match: p => p === '/' },
  { id: 'groups', label: 'Groups', icon: 'groups', href: '/groups', match: p => p.startsWith('/groups') },
  { id: 'activity', label: 'Activity', icon: 'activity', href: '/activity', match: p => p.startsWith('/activity') },
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
  const router = useRouter()
  const { data: groups = [] } = useGroups()
  const { data: profile } = useCurrentProfile()

  const activeId = getPrimaryActive(pathname) ?? ''
  const { containerRef, setRef, box } = useSlider(activeId)

  const [menuOpen, setMenuOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement | null>(null)

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
        background: T.sidebarBg,
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
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.7, fontFamily: FH, color: T.ink }}>
          tally<span style={{ color: T.sun }}>.</span>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px 7px 12px' }}>
          <SectionLabel size="sm" color={T.inkFaint}>
            Groups
          </SectionLabel>
          <button
            type="button"
            onClick={() => router.push('/groups/new')}
            title="New group"
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              background: T.surfaceAlt,
              color: T.inkMuted,
              fontSize: 14,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ＋
          </button>
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
        ref={profileButtonRef}
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        className="wntap"
        style={{
          width: '100%',
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          borderTop: `0.5px solid ${T.line}`,
          textAlign: 'left',
        }}
      >
        <Avatar profile={profile ?? undefined} slot={0} size={34} isYou />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13.5,
            fontWeight: 700,
            fontFamily: F,
            color: T.ink,
          }}
        >
          {profile ? profile.display_name ?? profile.name : 'You'}
        </span>
        <span style={{ fontSize: 11, color: T.inkFaint, flexShrink: 0 }}>▲</span>
      </button>

      <ProfileMenuPopover open={menuOpen} anchorRef={profileButtonRef} onClose={() => setMenuOpen(false)} />
    </aside>
  )
}
