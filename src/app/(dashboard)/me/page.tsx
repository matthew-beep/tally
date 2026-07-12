'use client'

import { useEffect, useRef, useState } from 'react'
import { T, FH, F, FMONO } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { HandleInput } from '@/components/HandleInput'
import type { HandleState } from '@/components/HandleInput'
import { useCurrentProfile, useMarkNotificationsRead, useNotifications, useUpdateProfile } from '@/queries/useProfile'
import { useConfirmSettlement, useDenySettlement } from '@/queries/useSettlements'
import { useAcceptGroupInvite, useDeclineGroupInvite } from '@/queries/useMembers'
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
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted }}>
        Edit profile
      </div>

      {/* Display name */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted, marginBottom: 8 }}>
          Display name
        </div>
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
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted, marginBottom: 8 }}>
          Handle
        </div>
        <HandleInput
          value={handle}
          onChange={setHandle}
          currentProfileId={profile.id}
          currentHandle={profile.handle}
          profileName={profile.name}
          onStateChange={setHandleState}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        style={{
          width: '100%', padding: '13px',
          borderRadius: T.r.md, border: 'none',
          background: canSave ? T.ink : T.surfaceAlt,
          color: canSave ? T.bg : T.inkMuted,
          fontFamily: FH, fontSize: 15, fontWeight: 600,
          cursor: canSave ? 'pointer' : 'default',
          transition: 'background 0.15s',
        }}
      >
        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
      </button>

      {updateProfile.isSuccess && (
        <div style={{ fontSize: 12, color: T.mintInk, fontWeight: 600, textAlign: 'center', marginTop: -8 }}>
          Saved ✓
        </div>
      )}
    </Card>
  )
}

// Read-only rows: rendered once, auto-marked read. Actionable types
// (group_invite, settlement_confirm) keep their own card sections above.
const INFO_TYPES: Notification['type'][] = [
  'group_invite_accepted',
  'group_invite_declined',
  'settlement_confirmed',
  'settlement_denied',
]

function infoLabel(n: Notification): string {
  switch (n.type) {
    case 'group_invite_accepted': return `✓ Your invite to ${n.group?.name ?? 'a group'} was accepted`
    case 'group_invite_declined': return `Your invite to ${n.group?.name ?? 'a group'} was declined`
    case 'settlement_confirmed':  return '✓ Payment confirmed'
    case 'settlement_denied':     return '✗ Payment denied'
    default: return ''
  }
}

export default function MePage() {
  const router = useRouter()
  const { data: profile } = useCurrentProfile()
  const { data: notifications = [] } = useNotifications()
  const { isDark, toggle } = useTheme()
  const markRead = useMarkNotificationsRead()
  const markedIds = useRef<Set<string>>(new Set())

  const infoNotifications = notifications.filter(n => INFO_TYPES.includes(n.type))

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
    router.push('/login')
  }

  return (
    <DashboardPage>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, marginBottom: 24 }}>Me</div>

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

        {/* Group invites */}
        {notifications.filter(n => n.type === 'group_invite').length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10 }}>
              Group invites
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications
                .filter(n => n.type === 'group_invite')
                .map(n => <GroupInviteCard key={n.id} notification={n} />)
              }
            </div>
          </div>
        )}

        {/* Settlement confirmations */}
        {notifications.filter(n => n.type === 'settlement_confirm').length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10 }}>
              Confirmation requests
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications
                .filter(n => n.type === 'settlement_confirm')
                .map(n => <SettlementConfirmCard key={n.id} notification={n} />)
              }
            </div>
          </div>
        )}

        {/* Info notifications — no action required, auto-marked read on view */}
        {infoNotifications.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10 }}>
              Notifications
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {infoNotifications.map(n => (
                <Card key={n.id} style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, color: T.ink }}>
                    {infoLabel(n)}
                  </div>
                  {(n.type === 'settlement_confirmed' || n.type === 'settlement_denied') && (
                    <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>
                      ${Number(n.settlement?.amount ?? 0).toFixed(2)}
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
        <button
          onClick={signOut}
          style={{ marginTop: 8, background: 'none', border: `1.5px solid ${T.lineStrong}`, borderRadius: T.r.md, padding: '11px 20px', fontSize: 14, fontWeight: 600, color: T.inkMuted, cursor: 'pointer', fontFamily: F, width: '100%' }}
        >
          Sign out
        </button>
    </DashboardPage>
  )
}

function GroupInviteCard({ notification }: { notification: Notification }) {
  const accept = useAcceptGroupInvite()
  const decline = useDeclineGroupInvite()
  const g = notification.group
  if (!g || !notification.group_id) return null

  return (
    <Card style={{ padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 24, lineHeight: 1 }}>{g.emoji}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>You've been invited to {g.name}</div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>Accept to join and see expenses</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => accept.mutate({ groupId: notification.group_id!, notificationId: notification.id })}
          disabled={accept.isPending || decline.isPending}
          style={{ flex: 1, background: T.mintSoft, color: T.mintInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✓ Accept
        </button>
        <button
          onClick={() => decline.mutate({ groupId: notification.group_id!, notificationId: notification.id })}
          disabled={accept.isPending || decline.isPending}
          style={{ flex: 1, background: T.coralSoft, color: T.coralInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✗ Decline
        </button>
      </div>
    </Card>
  )
}

function SettlementConfirmCard({ notification }: { notification: Notification }) {
  const confirm = useConfirmSettlement()
  const deny = useDenySettlement()
  const s = notification.settlement
  if (!s) return null

  const fromP    = s.from_member?.profile
  const fromName = fromP ? (fromP.display_name ?? fromP.name) : s.from_member?.name ?? '…'

  return (
    <Card style={{ padding: '14px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {fromName} says they paid you ${Number(s.amount).toFixed(2)}
      </div>
      {s.note && <div style={{ fontSize: 12, color: T.inkMuted, marginBottom: 12 }}>{s.note}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => confirm.mutate({ id: s.id, groupId: s.group_id })}
          disabled={confirm.isPending}
          style={{ flex: 1, background: T.mintSoft, color: T.mintInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✓ Confirm
        </button>
        <button
          onClick={() => deny.mutate({ id: s.id, groupId: s.group_id })}
          disabled={deny.isPending}
          style={{ flex: 1, background: T.coralSoft, color: T.coralInk, border: 'none', borderRadius: T.r.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          ✗ Deny
        </button>
      </div>
    </Card>
  )
}
