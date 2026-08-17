'use client'

import { T, F, FH, FMONO } from '@/design/tokens'
import { Modal } from '@/components/modal'
import { Card } from '@/components/Card'
import { SectionLabel } from '@/components/SectionLabel'
import { Btn } from '@/components/Btn'
import { Avatar } from '@/components/Avatar'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Visual stand-in for /me's content in a centered desktop modal, opened from
 * the sidebar's Settings row. Static — mirrors /me's layout (profile card,
 * edit fields, notifications, appearance, sign out) but isn't wired to real
 * queries/mutations yet. See ProfileMenuPopover for the trigger.
 */
export function SettingsModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} maxWidth={480}>
      <Modal.Header title="Settings" />
      <Modal.Content>
        {/* Profile card */}
        <Card style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar profile={{ name: 'Matthew Herradura', display_name: null, avatar_url: null }} slot={0} size={52} isYou />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FH }}>Matthew Herradura</div>
            <div style={{ fontSize: 12, color: T.inkMuted, fontFamily: FMONO, marginTop: 2 }}>@matt</div>
            <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>Code: M2N5K7P3</div>
          </div>
        </Card>

        {/* Edit profile */}
        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 16 }}>
          <SectionLabel>Edit profile</SectionLabel>

          <div>
            <SectionLabel style={{ marginBottom: 8 }}>Display name</SectionLabel>
            <input
              defaultValue="Matthew Herradura"
              style={{
                width: '100%', padding: '12px 14px',
                borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`,
                background: T.surfaceAlt, fontSize: 15, fontFamily: F,
                color: T.ink, outline: 'none',
              }}
            />
          </div>

          <div>
            <SectionLabel style={{ marginBottom: 8 }}>Handle</SectionLabel>
            <input
              defaultValue="@matt"
              style={{
                width: '100%', padding: '12px 14px',
                borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`,
                background: T.surfaceAlt, fontSize: 15, fontFamily: F,
                color: T.ink, outline: 'none',
              }}
            />
          </div>

          <Btn
            disabled variant="dark" size="lg" fullWidth
            style={{ padding: '13px', fontFamily: FH, fontSize: 15 }}
          >
            Save changes
          </Btn>
        </Card>

        {/* Notifications */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel style={{ marginBottom: 10 }}>Notifications</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 13, color: T.ink }}>✓ Invite accepted — Big Sur Trip</div>
            </Card>
            <Card style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 13, color: T.ink }}>✓ Payment confirmed</div>
              <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>$25.00</div>
            </Card>
          </div>
        </div>

        {/* Appearance */}
        <Card style={{ padding: '4px 8px', marginBottom: 16 }}>
          <div
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px', fontFamily: F,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>☀️</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>Light mode</span>
            </div>
            <div style={{ width: 44, height: 26, borderRadius: 99, background: T.lineStrong, position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: 99, background: T.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </Card>

        {/* Sign out */}
        <Btn
          disabled variant="outline" size="lg" fullWidth
          style={{ marginTop: 8, padding: '11px 20px', fontSize: 14, fontFamily: F }}
        >
          Sign out
        </Btn>
      </Modal.Content>
    </Modal>
  )
}
