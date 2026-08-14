'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { T, F } from '@/design/tokens'
import { useSignOut } from '@/queries/useAuth'
import { useCurrentProfile } from '@/queries/useProfile'
import { useTheme } from '@/lib/theme'
import { Avatar } from '@/components/Avatar'

interface Props {
  open: boolean
  /** The sidebar profile button this popover sits above. */
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}

const GAP = 8
const MARGIN = 8

/**
 * Desktop sidebar profile menu: identity card (→ /me) + theme toggle + sign
 * out, floating above the profile button at the bottom of the sidebar.
 *
 * Portalled and positioned `fixed` off the anchor's getBoundingClientRect,
 * same approach as EmojiPopover — the sidebar's own layout isn't a reliable
 * container for an overlay that needs to escape it.
 */
export function ProfileMenuPopover({ open, anchorRef, onClose }: Props) {
  const router = useRouter()
  const signOut = useSignOut()
  const { data: profile } = useCurrentProfile()
  const { isDark, toggle } = useTheme()
  const popRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; origin: 'top' | 'bottom' } | null>(null)

  // Layout effect so the first paint is already in place — measuring in a
  // regular effect shows one frame at the origin before it snaps.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }

    function place() {
      const anchor = anchorRef.current
      const pop = popRef.current
      if (!anchor || !pop) return
      const a = anchor.getBoundingClientRect()
      const p = pop.getBoundingClientRect()

      const above = a.top - p.height - GAP
      const fitsAbove = above >= MARGIN
      const top = fitsAbove ? above : a.bottom + GAP
      const left = Math.min(
        Math.max(MARGIN, a.left),
        window.innerWidth - p.width - MARGIN
      )
      // Pop scales in from whichever edge sits against the anchor, so it
      // reads as anchored to the button rather than materializing in place.
      setPos({ top, left, width: a.width, origin: fitsAbove ? 'bottom' : 'top' })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (popRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return // let the button toggle itself
      onClose()
    }

    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const name = profile ? profile.display_name ?? profile.name : 'You'
  const light = !isDark

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderTop: `1px solid ${T.line}`,
    cursor: 'pointer',
    font: 'inherit',
    fontFamily: F,
    background: 'transparent',
    color: T.ink,
    padding: '11px 14px',
    fontSize: 13,
    fontWeight: 600,
  }

  return createPortal(
    <div
      ref={popRef}
      role="menu"
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        minWidth: pos ? Math.max(pos.width, 200) : 200,
        // Hidden for the measuring pass so it never flashes at the origin.
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 400,
        background: T.bg,
        border: `0.5px solid ${T.line}`,
        borderRadius: T.r.lg,
        boxShadow: `${T.shadowFloat}, inset 0 0 0 1px ${T.line}`,
        overflow: 'hidden',
        animation: 'tally-pop 0.14s ease',
        transformOrigin: pos?.origin === 'top' ? 'top center' : 'bottom center',
      }}
    >
      <button
        role="menuitem"
        className="wntap"
        onClick={() => { onClose(); router.push('/me') }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          width: '100%',
          textAlign: 'left',
          border: 'none',
          cursor: 'pointer',
          background: 'transparent',
          padding: '14px 14px 13px',
        }}
      >
        <Avatar profile={profile ?? undefined} slot={0} size={38} isYou />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: F,
              color: T.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
          {profile?.handle && (
            <div style={{ fontSize: 11.5, color: T.inkFaint, fontFamily: F, marginTop: 1 }}>@{profile.handle}</div>
          )}
        </div>
      </button>

      <button role="menuitem" className="wntap" onClick={toggle} style={rowStyle}>
        <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: T.inkMuted }}>
          {light ? '☀' : '☾'}
        </span>
        <span style={{ flex: 1 }}>{light ? 'Light mode' : 'Dark mode'}</span>
        <span
          style={{
            width: 34,
            height: 20,
            borderRadius: 999,
            background: light ? T.sun : T.lineStrong,
            position: 'relative',
            flexShrink: 0,
            transition: 'background .15s ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: light ? 16 : 2,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
              transition: 'left .15s ease',
            }}
          />
        </span>
      </button>

      <button
        role="menuitem"
        className="wntap"
        onClick={() => { onClose(); signOut.mutate() }}
        disabled={signOut.isPending}
        style={{ ...rowStyle, color: T.coralInk, opacity: signOut.isPending ? 0.5 : 1 }}
      >
        <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path
              d="M6 2H3v12h3M10 5l3 3-3 3M13 8H6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {signOut.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>,
    document.body,
  )
}
