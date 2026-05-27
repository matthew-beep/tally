'use client'

import { T, FH, F } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { useCurrentProfile, useNotifications } from '@/queries/useProfile'
import { useConfirmSettlement, useDenySettlement } from '@/queries/useSettlements'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Notification } from '@/types'

export default function MePage() {
  const router = useRouter()
  const { data: profile } = useCurrentProfile()
  const { data: notifications = [] } = useNotifications()

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
              {profile.add_code && (
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 3 }}>Code: {profile.add_code}</div>
              )}
            </div>
          </Card>
        )}

        {/* Notifications */}
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

        {/* Other notifications */}
        {notifications.filter(n => n.type !== 'settlement_confirm').length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 10 }}>
              Notifications
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.filter(n => n.type !== 'settlement_confirm').map(n => (
                <Card key={n.id} style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, color: T.ink }}>
                    {n.type === 'settlement_confirmed' ? '✓ Payment confirmed' : '✗ Payment denied'}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>
                    ${Number(n.settlement?.amount ?? 0).toFixed(2)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          style={{ marginTop: 24, background: 'none', border: `1.5px solid ${T.lineStrong}`, borderRadius: T.r.md, padding: '11px 20px', fontSize: 14, fontWeight: 600, color: T.inkMuted, cursor: 'pointer', fontFamily: F, width: '100%' }}
        >
          Sign out
        </button>
    </DashboardPage>
  )
}

function SettlementConfirmCard({ notification }: { notification: Notification }) {
  const confirm = useConfirmSettlement()
  const deny = useDenySettlement()
  const s = notification.settlement
  if (!s) return null

  const fromName = s.from_profile ? (s.from_profile.display_name ?? s.from_profile.name) : '…'

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
