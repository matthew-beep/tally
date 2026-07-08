'use client'

import { useRouter } from 'next/navigation'
import { ModalOrSheet } from '@/components/modal'
import { Avatar } from '@/components/Avatar'
import { avatarProfile } from '@/lib/memberDisplay'
import { T, FH, FMONO } from '@/design/tokens'
import type { Profile } from '@/types'

interface PersonPart {
  groupId: string
  groupName: string
  groupEmoji: string
  amount: number
}

interface BalanceSheetProps {
  open: boolean
  onClose: () => void
  name: string
  profile?: Profile   // absent for guests — name-only member rows
  slot: 0 | 1 | 2 | 3
  net: number
  parts: PersonPart[]
}

export function BalanceSheet({ open, onClose, name, profile, slot, net, parts }: BalanceSheetProps) {
  const router = useRouter()
  const owed = net > 0
  const amtColor  = owed ? T.mintInk  : T.coralInk
  const amtBg     = owed ? T.mintSoft : T.coralSoft
  const firstName = name.split(' ')[0]

  const visibleParts = parts
    .filter(p => Math.abs(p.amount) >= 0.01)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  // For settle CTA: navigate to the group with the largest outstanding balance
  const settleGroupId = visibleParts[0]?.groupId

  const abs = Math.abs(net)
  const whole = Math.floor(abs).toLocaleString()
  const cents = (abs % 1).toFixed(2).slice(1)

  return (
    <ModalOrSheet open={open} onClose={onClose} title={`Balance with ${name}`}>
      <div style={{ overflowY: 'auto', paddingBottom: 44 }}>
        {/* Person identity */}
        <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar profile={avatarProfile({ name, profile })} slot={slot} size={50} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 19, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>
              {name}
            </div>
            {profile?.handle
              ? (
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2, fontFamily: FMONO }}>
                  @{profile.handle}
                </div>
              )
              : !profile && (
                <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
                  Guest — no account
                </div>
              )}
          </div>
        </div>

        {/* Big amount card */}
        <div style={{ margin: '0 16px 18px' }}>
          <div style={{
            background: amtBg, borderRadius: 22, padding: '18px 22px',
            border: `1px solid ${owed ? T.mint : T.coral}22`,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              textTransform: 'uppercase', color: amtColor, opacity: 0.85, marginBottom: 9,
            }}>
              {owed ? `${firstName} owes you` : `You owe ${firstName}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, lineHeight: 1 }}>
              <span style={{ fontFamily: FH, fontSize: 26, fontWeight: 500, color: amtColor, opacity: 0.7 }}>$</span>
              <span style={{ fontFamily: FH, fontSize: 48, fontWeight: 700, letterSpacing: -1.5, color: amtColor, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
              <span style={{ fontFamily: FMONO, fontSize: 20, fontWeight: 600, color: amtColor, opacity: 0.7 }}>{cents}</span>
            </div>
          </div>
        </div>

        {/* Group breakdown */}
        {visibleParts.length > 0 && (
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted, padding: '0 4px 10px' }}>
              By group
            </div>
            <div style={{
              background: T.surface, borderRadius: 18, overflow: 'hidden',
              border: `0.5px solid ${T.line}`,
            }}>
              {visibleParts.map((part, i) => {
                const partOwed = part.amount > 0
                return (
                  <div
                    key={part.groupId}
                    onClick={() => { onClose(); router.push(`/groups/${part.groupId}`) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                      borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 13, background: T.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {part.groupEmoji}
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>{part.groupName}</div>
                    <div style={{
                      fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.4,
                      color: partOwed ? T.mintInk : T.coralInk,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {partOwed ? '+' : '−'}${Math.abs(part.amount).toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA — guests have no account to remind; owed-by-guest shows no action */}
        <div style={{ padding: '0 16px' }}>
          {owed ? (
            profile && (
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: 16, borderRadius: 18,
                  background: T.sun, color: T.sunOn,
                  border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
                  boxShadow: '0 8px 24px rgba(242,192,74,0.35)',
                }}
              >
                Remind {firstName}
              </button>
            )
          ) : (
            <button
              onClick={() => {
                onClose()
                if (settleGroupId) router.push(`/groups/${settleGroupId}/settle`)
              }}
              style={{
                width: '100%', padding: 16, borderRadius: 18,
                background: T.coral, color: '#fff',
                border: 0, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
                boxShadow: '0 8px 24px rgba(239,97,68,0.30)',
              }}
            >
              Settle up with {firstName}
            </button>
          )}
        </div>
      </div>
    </ModalOrSheet>
  )
}
