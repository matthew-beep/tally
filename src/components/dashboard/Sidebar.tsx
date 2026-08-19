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
import { SettingsModal } from '@/components/dashboard/SettingsModal'
import { useSidebarRail } from '@/lib/sidebar'

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
  // Active items sit on the solid sun SliderPill, so they take `sunOn` — dark
  // ink on sun in BOTH themes. `sidebarActiveInk` is for the group rows below,
  // which sit on translucent `sidebarActiveSoft` and do flip with the theme.
  const ink = active ? T.sunOn : T.sidebarNavInk
  return (
    <div ref={setRef(id)}>
      <Link
        href={href}
        className="wntap sidebar-nav-item"
        title={label}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 10,
          color: ink,
          fontSize: 15,
          fontWeight: active ? 700 : 500,
          textDecoration: 'none',
          transform: 'none',
        }}
      >
        <WebNavIcon name={icon} color={ink} fill={active} />
        <span className="sidebar-label" style={{ flex: 1, textOverflow: 'ellipsis' }}>
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

  const { rail, toggle: toggleRail } = useSidebarRail()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const profileFooterRef = useRef<HTMLDivElement | null>(null)
  const firstName = (profile ? profile.display_name ?? profile.name : 'You').trim().split(/\s+/)[0]

  return (
    // A FLOATING panel — it sits above the app rather than being welded to the
    // window edge. Height comes from the wrapper's flex stretch (see
    // .dashboard-sidebar in dashboard.css, which supplies the inset), not from
    // 100dvh, so the panel stays inside its own padding.
    <aside
      // width/padding live in CSS (.dashboard-sidebar-panel) so the rail can
      // animate them without fighting an inline style.
      className="dashboard-sidebar-panel"
      style={{
        flexShrink: 0,
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: T.sidebarBg,
        borderRadius: T.r.panel,
        boxShadow: T.shadowFloat,
      }}
    >
      <div className="sidebar-header">
        <Link href="/" className="sidebar-logo" style={{ textDecoration: 'none', alignItems: 'center' }}>
          {/* font-size lives in CSS so the rail can scale the wordmark down to
              fit 64px without fighting an inline style. */}
          <span className="sidebar-logo-mark" style={{ fontWeight: 800, letterSpacing: -0.7, fontFamily: FH, color: T.ink }}>
            tally<span style={{ color: T.sun }}>.</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleRail}
          className="sidebar-icon-btn"
          title={rail ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!rail}
          style={{
            width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
            <line x1="6.25" y1="2.75" x2="6.25" y2="13.25" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </div>

      <div
        ref={containerRef}
        style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <SliderPill variant="pill" box={activeId ? box : null} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

        <div className="sidebar-groups" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '24px 12px 6px' }}>
          <SectionLabel size="sm" color={T.sidebarHeaderInk} style={{ fontSize: 10.5, letterSpacing: 0.8, fontWeight: 800 }}>
            Your groups
          </SectionLabel>
          <button
            type="button"
            onClick={() => router.push('/groups/new')}
            title="New group"
            className="sidebar-icon-btn"
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sidebar-groups" style={{ flexDirection: 'column', gap: 1, overflow: 'hidden', flex: 1, minHeight: 0 }}>
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
                className={`wntap sidebar-nav-item${active ? '' : ' gp-pick-row'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: active ? T.sidebarActiveInk : T.sidebarGroupInk,
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  background: active ? T.sidebarActiveSoft : undefined,
                  transition: 'background .15s ease, color .15s ease',
                  transform: 'none',
                }}
              >
                <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{group.emoji}</span>
                <span className="sidebar-label" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
      <div ref={profileFooterRef} style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          className="wntap gp-pick-row sidebar-profile-btn"
          title={firstName}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '9px 12px',
            borderRadius: 11,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transform: 'none',
          }}
        >
          <Avatar profile={profile ?? undefined} slot={0} size={34} isYou />
          <span
            className="sidebar-label"
            style={{
              flex: 1,
              minWidth: 0,
              textOverflow: 'ellipsis',
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: F,
              color: T.ink,
            }}
          >
            {firstName}
          </span>
          <svg className="sidebar-chevron" width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
            <path d="M4 10l4-4 4 4" fill="none" stroke={T.inkFaint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <ProfileMenuPopover
        open={menuOpen}
        anchorRef={profileFooterRef}
        onClose={() => setMenuOpen(false)}
        onSettings={() => setSettingsOpen(true)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  )
}
