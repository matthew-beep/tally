'use client'

// Scratch-only route to visually verify the restyled ProfileMenuPopover +
// new SettingsModal without needing an authenticated Supabase session.
// Delete before committing.

import { useRef, useState } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { ProfileMenuPopover } from '@/components/dashboard/ProfileMenuPopover'
import { SettingsModal } from '@/components/dashboard/SettingsModal'

export default function ProfilePopoverPreviewPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const profileFooterRef = useRef<HTMLDivElement | null>(null)

  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex' }}>
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          height: '100vh',
          boxSizing: 'border-box',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          background: T.sidebarBg,
          borderRight: `0.5px solid ${T.line}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 10px 18px' }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.7, fontFamily: FH, color: T.ink }}>
            tally<span style={{ color: T.sun }}>.</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div ref={profileFooterRef} style={{ marginTop: 8, borderTop: `0.5px solid ${T.line}` }}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', cursor: 'pointer', background: 'transparent',
              textAlign: 'left', border: 'none',
            }}
          >
            <Avatar profile={{ name: 'Matthew Herradura', display_name: null, avatar_url: null }} slot={0} size={34} isYou />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 700, fontFamily: F, color: T.ink }}>
              Matthew Herradura
            </span>
            <span style={{ fontSize: 11, color: T.inkFaint, flexShrink: 0 }}>▲</span>
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
    </div>
  )
}
