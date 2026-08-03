'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ModalOrSheet } from '@/components/modal'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, firstName as getFirstName } from '@/lib/memberDisplay'
import { SectionLabel } from '@/components/SectionLabel'
import { formatAmount } from '@/lib/money'
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

type Screen = 'balance' | 'confirm'

function GroupBreakdown({
  parts,
  onPartTap,
}: {
  parts: PersonPart[]
  onPartTap?: (part: PersonPart) => void
}) {
  return (
    <div style={{
      background: T.surface, borderRadius: 18, overflow: 'hidden',
      border: `0.5px solid ${T.line}`,
    }}>
      {parts.map((part, i) => {
        const partOwed = part.amount > 0
        return (
          <div
            key={part.groupId}
            onClick={onPartTap ? () => onPartTap(part) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none',
              cursor: onPartTap ? 'pointer' : 'default',
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
              {formatAmount(part.amount, { sign: true })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function BalanceSheet({ open, onClose, name, profile, slot, net, parts }: BalanceSheetProps) {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('balance')

  const owed = net > 0
  const amtColor  = owed ? T.mintInk  : T.coralInk
  const amtBg     = owed ? T.mintSoft : T.coralSoft
  const firstName = getFirstName(name)

  const visibleParts = parts
    .filter(p => Math.abs(p.amount) >= 0.01)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  const abs = Math.abs(net)
  const whole = Math.floor(abs).toLocaleString()
  const cents = (abs % 1).toFixed(2).slice(1)
  const groupCount = visibleParts.length
  const groupLabel = groupCount === 1 ? '1 group' : `${groupCount} groups`

  useEffect(() => {
    if (open) setScreen('balance')
  }, [open])

  function handleClose() {
    setScreen('balance')
    onClose()
  }

  function handleGroupTap(part: PersonPart) {
    handleClose()
    router.push(`/groups/${part.groupId}`)
  }

  const title = screen === 'confirm'
    ? `Settle up with ${firstName}`
    : `Balance with ${name}`

  return (
    <ModalOrSheet open={open} onClose={handleClose} title={title}>
      {screen === 'confirm' ? (
        <div style={{ overflowY: 'auto', paddingBottom: 44 }}>
          <div style={{ padding: '16px 20px 8px' }}>
            <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>
              Settle up with {firstName}
            </div>
            <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 6, lineHeight: 1.45 }}>
              You&apos;re about to settle{' '}
              <span style={{ fontWeight: 700, color: amtColor, fontFamily: FH }}>
                {formatAmount(net, { sign: true })}
              </span>
              {' '}across {groupLabel}
            </div>
          </div>

          <div style={{ margin: '10px 16px 18px' }}>
            <div style={{
              background: amtBg, borderRadius: 22, padding: '16px 22px',
              border: `1px solid ${owed ? T.mint : T.coral}22`,
            }}>
              <SectionLabel color={amtColor} style={{ opacity: 0.85, marginBottom: 8 }}>
                Total
              </SectionLabel>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, lineHeight: 1 }}>
                <span style={{ fontFamily: FH, fontSize: 22, fontWeight: 500, color: amtColor, opacity: 0.7 }}>$</span>
                <span style={{ fontFamily: FH, fontSize: 40, fontWeight: 700, letterSpacing: -1.2, color: amtColor, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
                <span style={{ fontFamily: FMONO, fontSize: 18, fontWeight: 600, color: amtColor, opacity: 0.7 }}>{cents}</span>
              </div>
            </div>
          </div>

          {visibleParts.length > 0 && (
            <div style={{ padding: '0 16px 18px' }}>
              <SectionLabel style={{ padding: '0 4px 10px' }}>By group</SectionLabel>
              <GroupBreakdown parts={visibleParts} />
            </div>
          )}

          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              // UI-only for now — multi-group settlement write comes next
              onClick={() => {}}
              style={{
                width: '100%', padding: 16, borderRadius: 18,
                background: T.sun, color: T.sunOn,
                border: 0, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
                boxShadow: '0 8px 24px rgba(242,192,74,0.35)',
              }}
            >
              Confirm settlement
            </button>
            <button
              type="button"
              onClick={() => setScreen('balance')}
              style={{
                width: '100%', padding: 14, borderRadius: 18,
                background: 'transparent', color: T.inkMuted,
                border: 0, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
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
              <SectionLabel color={amtColor} style={{ opacity: 0.85, marginBottom: 9 }}>
                {owed ? `${firstName} owes you` : `You owe ${firstName}`}
              </SectionLabel>
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
              <SectionLabel style={{ padding: '0 4px 10px' }}>By group</SectionLabel>
              <GroupBreakdown parts={visibleParts} onPartTap={handleGroupTap} />
            </div>
          )}

          {/* CTA — opens confirm state (no write yet) */}
          <div style={{ padding: '0 16px' }}>
            <button
              type="button"
              onClick={() => setScreen('confirm')}
              style={{
                width: '100%', padding: 16, borderRadius: 18,
                background: T.sun, color: T.sunOn,
                border: 0, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
                boxShadow: '0 8px 24px rgba(242,192,74,0.35)',
              }}
            >
              Settle up with {firstName}
            </button>
          </div>
        </div>
      )}
    </ModalOrSheet>
  )
}
