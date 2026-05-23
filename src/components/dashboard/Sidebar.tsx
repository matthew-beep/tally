'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { T, F, FH } from '@/design/tokens'
import { INITIAL_GROUPS, PEOPLE, type PersonKey } from '@/lib/mockData'

function Avi({ person, size = 32 }: { person: PersonKey; size?: number }) {
  const p = PEOPLE[person]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: p.color, color: p.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.34), fontWeight: 700, fontFamily: F,
      flexShrink: 0, letterSpacing: -0.5,
    }}>
      {p.initials}
    </div>
  )
}

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: '⌂', match: (path: string) => path === '/' },
  { label: 'Activity', href: '/activity', icon: '◷', match: (path: string) => path === '/activity' },
  { label: 'Friends', href: '/me', icon: '○', match: (path: string) => path === '/me' },
]

export function Sidebar() {
  const pathname = usePathname()
  const others = (Object.keys(PEOPLE) as PersonKey[]).filter(p => p !== 'you')

  return (
    <div style={{
      width: 232, flexShrink: 0, height: '100dvh', position: 'sticky', top: 0,
      borderRight: `1px solid ${T.line}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <Link href="/" style={{ textDecoration: 'none', padding: '22px 18px 20px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: T.ink, color: T.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FH, fontWeight: 800, fontSize: 17, letterSpacing: -1,
        }}>T</div>
        <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 17, letterSpacing: -0.5, color: T.ink }}>tally</span>
      </Link>

      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = item.match(pathname)
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: T.r.md,
                background: active ? T.bg : 'transparent',
                color: active ? T.ink : T.inkMuted,
                fontSize: 14, fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: 15, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          )
        })}
      </div>

      <div style={{ padding: '18px 8px 0', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.inkFaint, padding: '0 12px', marginBottom: 4 }}>
          Groups
        </div>
        {INITIAL_GROUPS.map(group => {
          const active = pathname === `/groups/${group.id}` || pathname.startsWith(`/groups/${group.id}/`)
          return (
            <Link key={group.id} href={`/groups/${group.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: T.r.md,
                background: active ? T.bg : 'transparent',
                color: T.ink, fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.bg }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 15 }}>{group.emoji}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
              </div>
            </Link>
          )
        })}
        <button style={{
          width: '100%', marginTop: 6,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: T.r.md, cursor: 'pointer',
          background: 'transparent', border: `1.5px dashed ${T.lineStrong}`,
          color: T.inkMuted, fontSize: 13, fontWeight: 500, fontFamily: F,
        }}>
          <span>＋</span> Quick Split
        </button>
      </div>

      <div style={{ padding: '16px 8px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.inkFaint, padding: '0 12px', marginBottom: 6 }}>
          Friends
        </div>
        {others.map(person => (
          <div key={person} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '5px 12px', borderRadius: T.r.md,
            color: T.ink, fontSize: 13, fontWeight: 500,
          }}>
            <Avi person={person} size={24} />
            {PEOPLE[person].name}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 16px 20px' }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
          background: T.bg, border: 'none', borderRadius: T.r.md,
          padding: '8px 12px', cursor: 'pointer',
          fontSize: 13, color: T.inkMuted, fontFamily: F, fontWeight: 500,
        }}>
          ☀️ Light mode
        </button>
      </div>
    </div>
  )
}
