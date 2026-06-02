'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { T, F, FH } from '@/design/tokens'
import { useGroups } from '@/queries/useGroups'

const NAV_ITEMS = [
  { label: 'Home',     href: '/',         match: (p: string) => p === '/' },
  { label: 'Groups',   href: '/groups',   match: (p: string) => p === '/groups' },
  { label: 'Activity', href: '/activity', match: (p: string) => p === '/activity' },
  { label: 'Me',       href: '/me',       match: (p: string) => p === '/me' },
]

const ITEM_H = 36
const ITEM_GAP = 2
const SLOT = ITEM_H + ITEM_GAP
const NAV_EASE = 'cubic-bezier(0.34,1.56,0.64,1)'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: groups = [] } = useGroups()

  const activeIdx = NAV_ITEMS.findIndex(item => item.match(pathname))

  return (
    <div style={{ width: 232, flexShrink: 0, height: '100dvh', position: 'sticky', top: 0, background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', padding: '22px 18px 20px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: T.ink, color: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FH, fontWeight: 800, fontSize: 17, letterSpacing: -1 }}>T</div>
        <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 17, letterSpacing: -0.5, color: T.ink }}>tally</span>
      </Link>

      {/* Main nav */}
      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: ITEM_GAP, position: 'relative' }}>

        {/* Sliding background pill */}
        {activeIdx >= 0 && (
          <div style={{
            position: 'absolute',
            width: "100%",
            height: ITEM_H,
            borderRadius: T.r.md,
            background: T.sunSoft,
            top: activeIdx * SLOT,
            transition: `top .38s ${NAV_EASE}`,
            pointerEvents: 'none',
          }} />
        )}

        {NAV_ITEMS.map(item => {
          const active = item.match(pathname)
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center',
                  height: ITEM_H,
                  paddingLeft: 20, paddingRight: 12,
                  borderRadius: T.r.md,
                  color: active ? T.sunInk : T.inkFaint,
                  fontSize: 14, fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  position: 'relative', zIndex: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {item.label}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Groups list */}
      <div style={{ padding: '18px 8px 0', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.inkFaint, padding: '0 12px', marginBottom: 4 }}>
          Groups
        </div>
        {groups.length === 0 && (
          <div style={{ fontSize: 12, color: T.inkFaint, padding: '6px 12px' }}>No groups yet</div>
        )}
        {groups.map(group => {
          const active = pathname === `/groups/${group.id}` || pathname.startsWith(`/groups/${group.id}/`)
          return (
            <Link key={group.id} href={`/groups/${group.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: T.r.md, background: active ? T.surface : 'transparent', color: T.ink, fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 15 }}>{group.emoji}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
              </div>
            </Link>
          )
        })}
        <button
          onClick={() => router.push('/groups/new')}
          style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: T.r.md, cursor: 'pointer', background: 'transparent', border: `1.5px dashed ${T.lineStrong}`, color: T.inkMuted, fontSize: 13, fontWeight: 500, fontFamily: F }}
        >
          <span>＋</span> New group
        </button>
      </div>
    </div>
  )
}
