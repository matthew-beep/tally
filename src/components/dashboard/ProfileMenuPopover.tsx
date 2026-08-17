'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings } from 'lucide-react'
import { T, F } from '@/design/tokens'
import { useSignOut } from '@/queries/useAuth'
import { useCurrentProfile } from '@/queries/useProfile'
import { useTheme } from '@/lib/theme'
import { usePopoverPosition } from '@/lib/usePopoverPosition'
import { Avatar } from '@/components/Avatar'

interface Props {
  open: boolean
  /** The sidebar profile footer this popover sits flush above. */
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onSettings: () => void
}

const sunIcon = (
  <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M9 1.6v1.8M9 14.6v1.8M16.4 9h-1.8M3.4 9H1.6M14.2 3.8l-1.3 1.3M5.1 12.9l-1.3 1.3M14.2 14.2l-1.3-1.3M5.1 5.1L3.8 3.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const moonIcon = (
  <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
    <path
      d="M15 10.5A6.2 6.2 0 0 1 7.5 3a6.2 6.2 0 1 0 7.5 7.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

const logoutIcon = (
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
)

/** Shared row treatment for menu items below the identity header — rounded, hover-tinted. */
function PopoverRow({
  icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      role="menuitem"
      className="wntap"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        font: 'inherit',
        fontFamily: F,
        borderRadius: T.r.sm,
        padding: '9px 10px',
        fontSize: 13.5,
        fontWeight: 600,
        color: danger ? T.coralInk : T.ink,
        background: hover ? T.surfaceAlt : 'transparent',
        transition: 'background .12s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: danger ? T.coralInk : T.inkMuted }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  )
}

/** Same row treatment as PopoverRow, with an animated pill switch instead of a click action. */
function ThemeRow({ light, onToggle }: { light: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      role="menuitem"
      className="wntap"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontFamily: F,
        borderRadius: T.r.sm,
        padding: '9px 10px',
        fontSize: 13.5,
        fontWeight: 600,
        color: T.ink,
        background: hover ? T.surfaceAlt : 'transparent',
        transition: 'background .12s ease',
      }}
    >
      <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: T.inkMuted }}>
        {light ? sunIcon : moonIcon}
      </span>
      <span style={{ flex: 1 }}>{light ? 'Light mode' : 'Dark mode'}</span>
      <span
        style={{
          width: 36,
          height: 21,
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
            top: 2.5,
            left: light ? 17 : 2.5,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            transition: 'left .15s ease',
          }}
        />
      </span>
    </button>
  )
}

/**
 * Desktop sidebar profile menu: identity header + Settings (opens
 * SettingsModal) + theme toggle + sign out, sitting flush above the profile
 * footer at the bottom of the sidebar. Positioning + escape/outside-click
 * dismissal is shared with EmojiPopover via usePopoverPosition.
 */
export function ProfileMenuPopover({ open, anchorRef, onClose, onSettings }: Props) {
  const signOut = useSignOut()
  const { data: profile } = useCurrentProfile()
  const { isDark, toggle } = useTheme()
  const { popRef, pos } = usePopoverPosition({
    open, anchorRef, onClose, align: 'start', gap: 0, matchAnchorWidth: true,
  })

  if (!open) return null

  const name = profile ? profile.display_name ?? profile.name : 'You'
  const light = !isDark

  return createPortal(
    <div
      ref={popRef}
      role="menu"
      style={{
        position: 'fixed',
        top: pos?.top,
        bottom: pos?.bottom,
        left: pos?.left ?? 0,
        minWidth: pos ? Math.max(pos.width ?? 0, 200) : 200,
        // Hidden for the measuring pass so it never flashes at the origin.
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 400,
        background: T.bg,
        borderRadius: T.r.lg,
        boxShadow: `${T.shadowFloat}, inset 0 0 0 1px ${T.line}`,
        overflow: 'hidden',
        transformOrigin: 'bottom center',
        animation: 'tally-pop 0.15s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
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
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, padding: 6 }}>
        <PopoverRow
          icon={<Settings size={15} strokeWidth={1.5} />}
          label="Settings"
          onClick={() => { onClose(); onSettings() }}
        />
        <ThemeRow light={light} onToggle={toggle} />
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, padding: 6 }}>
        <PopoverRow
          icon={logoutIcon}
          label={signOut.isPending ? 'Signing out…' : 'Sign out'}
          danger
          disabled={signOut.isPending}
          onClick={() => { onClose(); signOut.mutate() }}
        />
      </div>
    </div>,
    document.body,
  )
}
