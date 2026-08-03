'use client'

import { useEffect, useState } from 'react'
import { ModalOrSheet } from '@/components/modal'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, firstName as getFirstName } from '@/lib/memberDisplay'
import { SectionLabel } from '@/components/SectionLabel'
import { formatAmount, stripNegative } from '@/lib/money'
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

type Screen = 'balance' | 'confirm' | 'group'

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
            {onPartTap && (
              <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                <path d="M5 3l4 4-4 4" fill="none" stroke={T.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Single-group drill-down — reached by tapping a row in the balance screen.
// Editable amount scoped to just this one group; settling here never
// touches the person's other groups. UI-only: the CTA is a no-op for now.
function GroupSettleScreen({
  part, amount, firstName, onChangeAmount, onBack,
}: {
  part: PersonPart
  amount: number
  firstName: string
  onChangeAmount: (v: number) => void
  onBack: () => void
}) {
  const full = Math.abs(part.amount)
  const partOwed = part.amount > 0
  const amtColor = partOwed ? T.mintInk : T.coralInk
  const clamp = (v: number) => Math.max(0, Math.min(full, Math.round(v * 100) / 100))
  const partial = amount > 0.005 && amount < full - 0.005
  const canSettle = amount >= 0.005

  return (
    <div style={{ overflowY: 'auto', paddingBottom: 44 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px 6px' }}>
        <button
          type="button" onClick={onBack} aria-label="Back"
          style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: T.surfaceAlt, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M9 2L3 7l6 5" fill="none" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span style={{ fontSize: 18 }}>{part.groupEmoji}</span>
        <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {part.groupName}
        </span>
      </div>

      <div style={{ padding: '10px 20px 4px' }}>
        <SectionLabel>{partOwed ? `${firstName} owes you here` : `You owe ${firstName} here`}</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 500, color: T.inkMuted, fontFamily: FH }}>$</span>
          <input
            type="number" inputMode="decimal" min={0} max={full} step="0.01"
            value={amount.toFixed(2)}
            onChange={e => onChangeAmount(clamp(parseFloat(stripNegative(e.target.value)) || 0))}
            style={{ border: 0, outline: 0, background: 'transparent', padding: 0, width: 180, fontFamily: FH, fontSize: 42, fontWeight: 700, letterSpacing: -1.4, color: amtColor }}
          />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: partial ? T.sunInk : T.inkMuted, marginTop: 4 }}>
          {partial ? `Partial · ${formatAmount(full - amount)} stays open` : 'Full balance'}
        </div>
      </div>

      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {([['Full', full], ['Half', full / 2], ['Clear', 0]] as [string, number][]).map(([label, v]) => {
            const on = Math.abs(amount - v) < 0.005
            return (
              <button
                key={label} type="button" onClick={() => onChangeAmount(clamp(v))}
                style={{
                  flex: 1, border: 0, cursor: 'pointer', font: 'inherit', padding: '11px 0', borderRadius: 11,
                  background: on ? T.ink : 'transparent', color: on ? T.bg : T.ink,
                  boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
                  fontSize: 13.5, fontWeight: 700,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.inkFaint, padding: '14px 4px 0', margin: 0 }}>
          This only settles {part.groupName} — your other groups with {firstName} aren&apos;t touched.
        </p>
      </div>

      <div style={{ padding: '10px 20px 0' }}>
        <button
          type="button"
          disabled={!canSettle}
          // UI-only for now — per-group settlement write comes next
          onClick={() => {}}
          style={{
            width: '100%', padding: 16, borderRadius: 18,
            background: canSettle ? T.sun : T.surfaceAlt,
            color: canSettle ? T.sunOn : T.inkFaint,
            border: 0, cursor: canSettle ? 'pointer' : 'default', fontFamily: 'inherit',
            fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
            boxShadow: canSettle ? '0 8px 24px rgba(242,192,74,0.35)' : 'none',
            transition: 'all 0.18s',
          }}
        >
          {canSettle ? `Settle ${formatAmount(amount)} in ${part.groupName}` : 'Enter an amount'}
        </button>
      </div>
    </div>
  )
}

export function BalanceSheet({ open, onClose, name, profile, slot, net, parts }: BalanceSheetProps) {
  const [screen, setScreen] = useState<Screen>('balance')
  const [groupPart, setGroupPart] = useState<PersonPart | null>(null)
  const [groupAmount, setGroupAmount] = useState(0)

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
    if (open) {
      setScreen('balance')
      setGroupPart(null)
      setGroupAmount(0)
    }
  }, [open])

  function handleClose() {
    setScreen('balance')
    onClose()
  }

  // Tapping a row drills into that group's own editable settle screen, in
  // place — no navigating away from the sheet.
  function openGroupScreen(part: PersonPart) {
    setGroupPart(part)
    setGroupAmount(Math.abs(part.amount))
    setScreen('group')
  }

  // The main CTA settles everything at once — full balance, every group.
  // Per-group adjustments happen by drilling into a specific row instead.
  function openConfirmAll() {
    setScreen('confirm')
  }

  const title = screen === 'confirm'
    ? `Settle up with ${firstName}`
    : screen === 'group' && groupPart
    ? groupPart.groupName
    : `Balance with ${name}`

  return (
    <ModalOrSheet open={open} onClose={handleClose} title={title}>
      {screen === 'group' && groupPart ? (
        <GroupSettleScreen
          part={groupPart}
          amount={groupAmount}
          firstName={firstName}
          onChangeAmount={setGroupAmount}
          onBack={() => setScreen('balance')}
        />
      ) : screen === 'confirm' ? (
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

          {/* Group breakdown — tap a row to settle just that group */}
          {visibleParts.length > 0 && (
            <div style={{ padding: '0 16px 18px' }}>
              <SectionLabel style={{ padding: '0 4px 10px' }}>By group</SectionLabel>
              <GroupBreakdown parts={visibleParts} onPartTap={openGroupScreen} />
            </div>
          )}

          {/* CTA — settle everything at once (no write yet) */}
          <div style={{ padding: '0 16px' }}>
            <button
              type="button"
              onClick={openConfirmAll}
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
