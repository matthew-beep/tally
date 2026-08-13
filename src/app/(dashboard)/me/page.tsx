'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { T, FH, F, FMONO } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { Card } from '@/components/Card'
import { SectionLabel } from '@/components/SectionLabel'
import { Btn } from '@/components/Btn'
import { formatAmount } from '@/lib/money'
import { Avatar } from '@/components/Avatar'
import { HandleInput } from '@/components/HandleInput'
import type { HandleState } from '@/components/HandleInput'
import { useCurrentProfile, useMarkNotificationsRead, useNotifications, useUpdateProfile } from '@/queries/useProfile'
import { useTheme } from '@/lib/theme'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Notification } from '@/types'

function ProfileSettings() {
  const { data: profile } = useCurrentProfile()
  const updateProfile = useUpdateProfile()

  const [displayName,  setDisplayName]  = useState('')
  const [handle,       setHandle]       = useState('')
  const [handleState,  setHandleState]  = useState<HandleState>('available')
  const [initialized,  setInitialized]  = useState(false)

  // Seed fields once profile loads
  if (profile && !initialized) {
    setDisplayName(profile.display_name ?? profile.name)
    setHandle(profile.handle ?? '')
    setInitialized(true)
  }

  if (!profile) return null

  const displayNameChanged = displayName.trim() !== (profile.display_name ?? profile.name)
  const handleChanged      = handle !== (profile.handle ?? '')
  const canSave = (displayNameChanged || handleChanged) &&
    (!handleChanged || handleState === 'available') &&
    !updateProfile.isPending

  async function handleSave() {
    if (!canSave || !profile) return
    const updates: { display_name?: string; handle?: string } = {}
    if (displayNameChanged) updates.display_name = displayName.trim()
    if (handleChanged)      updates.handle        = handle
    await updateProfile.mutateAsync({ profileId: profile.id, updates })
  }

  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 16 }}>
      <SectionLabel>Edit profile</SectionLabel>

      {/* Display name */}
      <div>
        <SectionLabel style={{ marginBottom: 8 }}>Display name</SectionLabel>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder={profile.name}
          style={{
            width: '100%', padding: '12px 14px',
            borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`,
            background: T.surfaceAlt, fontSize: 15, fontFamily: F,
            color: T.ink, outline: 'none',
          }}
        />
      </div>

      {/* Handle */}
      <div>
        <SectionLabel style={{ marginBottom: 8 }}>Handle</SectionLabel>
        <HandleInput
          value={handle}
          onChange={setHandle}
          currentProfileId={profile.id}
          currentHandle={profile.handle}
          profileName={profile.name}
          onStateChange={setHandleState}
        />
      </div>

      <Btn
        onClick={handleSave} disabled={!canSave} variant="dark" size="lg" fullWidth
        style={{
          padding: '13px',
          background: canSave ? T.ink : T.surfaceAlt,
          color: canSave ? T.bg : T.inkMuted,
          fontFamily: FH, fontSize: 15,
          transition: 'background 0.15s',
        }}
      >
        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
      </Btn>

      {updateProfile.isSuccess && (
        <div style={{ fontSize: 12, color: T.mintInk, fontWeight: 600, textAlign: 'center', marginTop: -8 }}>
          Saved ✓
        </div>
      )}
    </Card>
  )
}

// Read-only rows: rendered once, auto-marked read. Actionable types
// (group_invite, settlement_confirm) are reviewed from the home rail or the
// group-detail bell, not from /me.
const INFO_TYPES: Notification['type'][] = [
  'group_invite_accepted',
  'group_invite_declined',
  'settlement_confirmed',
  'settlement_denied',
  'settlement_recorded',
]

function infoLabel(n: Notification): string {
  switch (n.type) {
    case 'group_invite_accepted':  return `✓ Invite accepted — ${n.group?.name ?? 'group'}`
    case 'group_invite_declined':  return `Invite declined — ${n.group?.name ?? 'group'}`
    case 'settlement_confirmed':   return '✓ Payment confirmed'
    case 'settlement_denied':      return '✗ Payment denied'
    case 'settlement_recorded':    return '✓ Marked as settled'
    default: return ''
  }
}

export default function MePage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: profile } = useCurrentProfile()
  const { data: notifications = [] } = useNotifications()
  const { isDark, toggle } = useTheme()
  const markRead = useMarkNotificationsRead()
  const markedIds = useRef<Set<string>>(new Set())

  const infoBatches = notifications.filter(b => INFO_TYPES.includes(b.type))
  // Flattened: info rows are read-only and auto-marked, so they read one per
  // event. Actionable items (group_invite, settlement_confirm) live only on
  // the home rail and the group-detail bell — not duplicated here.
  const infoNotifications = infoBatches.flatMap(b => b.notifications)

  useEffect(() => {
    const ids = infoNotifications.map(n => n.id).filter(id => !markedIds.current.has(id))
    if (ids.length === 0) return
    ids.forEach(id => markedIds.current.add(id))
    markRead.mutate(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoNotifications.map(n => n.id).join(',')])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Redundant with the auth-change listener in Providers — kept as
    // insurance so the explicit path never depends on it.
    qc.clear()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <AppHeader title="Me" />
      <DashboardPage>
        {/* Profile card */}
        {profile && (
          <Card style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <Avatar profile={profile} slot={0} size={52} isYou />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FH }}>{profile.display_name ?? profile.name}</div>
              {profile.handle && (
                <div style={{ fontSize: 12, color: T.inkMuted, fontFamily: FMONO, marginTop: 2 }}>@{profile.handle}</div>
              )}
              {profile.add_code && (
                <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>Code: {profile.add_code}</div>
              )}
            </div>
          </Card>
        )}

        {/* Profile editing */}
        <ProfileSettings />

        {/* Info notifications — no action required, auto-marked read on view */}
        {infoNotifications.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionLabel style={{ marginBottom: 10 }}>Notifications</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {infoNotifications.map(n => (
                <Card key={n.id} style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, color: T.ink }}>
                    {infoLabel(n)}
                  </div>
                  {(n.type === 'settlement_confirmed' || n.type === 'settlement_denied' || n.type === 'settlement_recorded') && (
                    <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>
                      {formatAmount(Number(n.amount ?? n.settlement?.amount ?? 0))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Appearance */}
        <Card style={{ padding: '4px 8px', marginBottom: 16 }}>
          <button
            onClick={toggle}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: F,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{isDark ? '🌙' : '☀️'}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>
                {isDark ? 'Dark mode' : 'Light mode'}
              </span>
            </div>
            {/* Toggle pill */}
            <div style={{
              width: 44, height: 26, borderRadius: 99,
              background: isDark ? T.ink : T.lineStrong,
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: 3,
                left: isDark ? 21 : 3,
                width: 20, height: 20, borderRadius: 99,
                background: isDark ? T.bg : T.surface,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: `left .25s cubic-bezier(0.34,1.56,0.64,1)`,
              }} />
            </div>
          </button>
        </Card>

        {/* Sign out */}
        <Btn
          onClick={signOut} variant="outline" size="lg" fullWidth
          style={{ marginTop: 8, padding: '11px 20px', fontSize: 14, fontFamily: F }}
        >
          Sign out
        </Btn>
      </DashboardPage>
    </div>
  )
}

