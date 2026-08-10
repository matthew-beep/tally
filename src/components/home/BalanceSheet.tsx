'use client'

import { useEffect, useState } from 'react'
import { ModalOrSheet } from '@/components/modal'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, firstName as getFirstName } from '@/lib/memberDisplay'
import { SectionLabel } from '@/components/SectionLabel'
import { formatAmount, stripNegative, round2 } from '@/lib/money'
import { useCreateSettlements } from '@/queries/useSettlements'
import { SettleSuccess } from '@/components/settle/SettleSuccess'
import type { SettlementAllocation } from '@/lib/settlements'
import { T, FH, FMONO } from '@/design/tokens'
import type { Profile, PersonPart } from '@/types'

// A part carries its own group and both seat ids, so it is everything needed
// to write one settlement row. `amount` is signed from my perspective:
// positive = they owe me (I'm recording that they paid me), negative = I owe.
function allocationFor(part: PersonPart, amount: number): SettlementAllocation {
  return {
    groupId: part.groupId,
    mySeatId: part.mySeatId,
    theirSeatId: part.groupMemberId,
    amount: Math.abs(amount),
    direction: part.amount > 0 ? 'owed' : 'owe',
  }
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

type Screen = 'balance' | 'confirm' | 'group' | 'success'

// What the success screen shows, captured from the rows the insert returned so
// the status is the database's answer rather than a client re-derivation.
interface SettledSummary {
  amount: number
  status: 'pending' | 'confirmed'
  groupCount: number
}

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
// touches the person's other groups (it writes a batch of one).
function GroupSettleScreen({
  part, amount, firstName, isPending, onChangeAmount, onSettle, onBack,
}: {
  part: PersonPart
  amount: number
  firstName: string
  isPending: boolean
  onChangeAmount: (v: number) => void
  onSettle: () => void
  onBack: () => void
}) {
  const full = Math.abs(part.amount)
  const partOwed = part.amount > 0
  const amtColor = partOwed ? T.mintInk : T.coralInk
  const clamp = (v: number) => Math.max(0, Math.min(full, Math.round(v * 100) / 100))
  const partial = amount > 0.005 && amount < full - 0.005
  const canSettle = amount >= 0.005 && !isPending

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
          onClick={onSettle}
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
  const [settled, setSettled] = useState<SettledSummary | null>(null)
  const createSettlements = useCreateSettlements()

  const owed = net > 0
  const amtColor  = owed ? T.mintInk  : T.coralInk
  const amtBg     = owed ? T.mintSoft : T.coralSoft
  const firstName = getFirstName(name)

  const visibleParts = parts
    .filter(p => Math.abs(p.amount) >= 0.01)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  // Derived from the *filtered* parts, not the `net` prop: settle-all iterates
  // visibleParts, so these are the figures the write will actually produce.
  // (The prop sums every entry including sub-cent residue — see TODO item 5's
  // buildPeopleFlow note.)
  const grossOwed  = round2(visibleParts.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0))
  const grossOwe   = round2(visibleParts.filter(p => p.amount < 0).reduce((s, p) => s - p.amount, 0))
  const grossTotal = round2(grossOwed + grossOwe)
  // What actually changes hands. Allocations are gross — each group zeroes at
  // its own full balance — but only the net is transferred (item 5 (b)).
  const netTransfer = round2(grossOwed - grossOwe)
  const mixed = grossOwed >= 0.01 && grossOwe >= 0.01

  const abs = Math.abs(netTransfer)
  const whole = Math.floor(abs).toLocaleString()
  const cents = (abs % 1).toFixed(2).slice(1)
  const groupCount = visibleParts.length
  const groupLabel = groupCount === 1 ? '1 group' : `${groupCount} groups`
  const canSettleAll = groupCount > 0 && !createSettlements.isPending
  // Names the net, not the gross: the button is what you're committing to send,
  // and gross alone would imply $50 changes hands when $10 does. The gross
  // allocation is disclosed in the body above instead.
  const confirmLabel = netTransfer >= 0 ? 'Mark as settled' : 'Record payment'

  useEffect(() => {
    if (open) {
      setScreen('balance')
      setGroupPart(null)
      setGroupAmount(0)
      setSettled(null)
    }
  }, [open])

  function handleClose() {
    setScreen('balance')
    setSettled(null)
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

  // Settle-all: one allocation per group, each at that group's full balance.
  // Gross, deliberately — netting them would leave balances open after an
  // action called "settle everything" (item 5 (b)). They share one batch_id
  // and one status, so the counterparty is asked about the payment once.
  async function handleSettleAll() {
    if (visibleParts.length === 0) return
    const rows = await createSettlements.mutateAsync({
      allocations: visibleParts.map(p => allocationFor(p, p.amount)),
    })
    setSettled({ amount: Math.abs(netTransfer), status: rows[0].status, groupCount: rows.length })
    setScreen('success')
  }

  // Drill-down: a single group, at whatever amount the user set. Never touches
  // their other groups — a batch of one.
  async function handleSettleGroup() {
    if (!groupPart || groupAmount < 0.005) return
    const rows = await createSettlements.mutateAsync({
      allocations: [allocationFor(groupPart, groupAmount)],
    })
    setSettled({ amount: groupAmount, status: rows[0].status, groupCount: rows.length })
    setScreen('success')
  }

  const title = screen === 'success'
    ? 'Settled'
    : screen === 'confirm'
    ? `Settle up with ${firstName}`
    : screen === 'group' && groupPart
    ? groupPart.groupName
    : `Balance with ${name}`

  return (
    <ModalOrSheet open={open} onClose={handleClose} title={title}>
      {screen === 'success' && settled ? (
        <SettleSuccess
          name={name}
          profile={profile}
          slot={slot}
          amount={settled.amount}
          status={settled.status}
          groupCount={settled.groupCount}
          onDone={handleClose}
        />
      ) : screen === 'group' && groupPart ? (
        <GroupSettleScreen
          part={groupPart}
          amount={groupAmount}
          firstName={firstName}
          isPending={createSettlements.isPending}
          onChangeAmount={setGroupAmount}
          onSettle={handleSettleGroup}
          onBack={() => setScreen('balance')}
        />
      ) : screen === 'confirm' ? (
        <div style={{ overflowY: 'auto', paddingBottom: 44 }}>
          <div style={{ padding: '16px 20px 8px' }}>
            <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>
              Settle up with {firstName}
            </div>
            <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 6, lineHeight: 1.45 }}>
              Zeroes {groupLabel} · {formatAmount(grossTotal)} settled
            </div>
          </div>

          <div style={{ margin: '10px 16px 18px' }}>
            <div style={{
              background: amtBg, borderRadius: 22, padding: '16px 22px',
              border: `1px solid ${owed ? T.mint : T.coral}22`,
            }}>
              {/* Mixed directions: show the gross each way before the net, so
                  the number that moves and the balances being cleared are both
                  visible. Net alone hides that two groups are being zeroed;
                  gross alone implies $50 changes hands when $10 does. */}
              {mixed && (
                <div style={{ marginBottom: 14 }}>
                  {([
                    [`You pay ${firstName}`, grossOwe,  T.coralInk],
                    [`${firstName} pays you`, grossOwed, T.mintInk],
                  ] as [string, number, string][]).map(([label, value, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6 }}>
                      <span style={{ fontSize: 13, color: T.inkMuted }}>{label}</span>
                      <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color }}>{formatAmount(value)}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: `${amtColor}22`, margin: '4px 0 0' }} />
                </div>
              )}

              <SectionLabel color={amtColor} style={{ opacity: 0.85, marginBottom: 8 }}>
                {mixed ? (netTransfer >= 0 ? `${firstName} sends you` : `You send ${firstName}`) : 'Total'}
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
            {/* One request per payment, not per group — every row shares the
                batch's status, so the counterparty is asked once, about the
                net (item 5 (a′)/(e)). */}
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: T.inkFaint, padding: '0 4px 4px', margin: 0 }}>
              {netTransfer >= 0
                ? `Recorded straight away — ${firstName} is notified, with nothing to confirm.`
                : `${firstName} gets one request to confirm ${formatAmount(abs)}.`}
            </p>
            <button
              type="button"
              disabled={!canSettleAll}
              onClick={handleSettleAll}
              style={{
                width: '100%', padding: 16, borderRadius: 18,
                background: canSettleAll ? T.sun : T.surfaceAlt,
                color: canSettleAll ? T.sunOn : T.inkFaint,
                border: 0, cursor: canSettleAll ? 'pointer' : 'default', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
                boxShadow: canSettleAll ? '0 8px 24px rgba(242,192,74,0.35)' : 'none',
                transition: 'all 0.18s',
              }}
            >
              {confirmLabel} · {formatAmount(abs)}
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
