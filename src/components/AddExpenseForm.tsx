'use client'

// Two layouts, one component — branches on `isMobile` near the bottom:
//   Desktop: two-column modal (ModeTabs + DesktopSplitList right, tiles left).
//   Mobile: title + amount, two collapsible rows (Paid by, Split algorithm),
//           always-visible Expense Details (ExpenseBreakdown / BreakdownItems).
// Both branches share the same state and handleSave/canSave logic.

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { T, FH, F, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useAddExpense } from '@/queries/useExpenses'
import { useCurrentProfile } from '@/queries/useProfile'
import { detectCategory, CATEGORIES } from '@/lib/categories'
import { makeEqualSplits, makePercentSplits, makeExactSplits } from '@/lib/splits'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { ModalOrSheet } from '@/components/modal'
import type { GroupMember } from '@/types'

type SplitMode = 'equal' | 'percentage' | 'exact' | 'itemized'

// UI-only line item for the mobile itemized receipt builder (BreakdownItems).
// Nothing here reaches handleSave — expense_items tables don't exist yet.
interface LineItem {
  id: number
  name: string
  price: number
  assignedTo: string[]
}

interface TaxTipRow {
  label: string
  mode: 'percent' | 'flat'
  setMode: (m: 'percent' | 'flat') => void
  val: number
  setVal: (v: number) => void
  amt: number
}

const TILE_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
  textTransform: 'uppercase', color: T.inkMuted,
}

function stripNegative(v: string) {
  return v.replace(/-/g, '')
}

function shortName(m: GroupMember | undefined, youMemberId?: string) {
  if (!m) return '…'
  if (m.id === youMemberId) return 'You'
  return displayName(m).split(' ')[0]
}

// ── Shared components ────────────────────────────────────────────────────────

// Desktop 4-way split_type tab strip. Mobile uses AlgorithmRadios instead.
function ModeTabs({ value, onChange }: { value: SplitMode; onChange: (m: SplitMode) => void }) {
  const tabs: { v: SplitMode; l: string }[] = [
    { v: 'equal',      l: 'Equal'    },
    { v: 'percentage', l: 'Percent'  },
    { v: 'exact',      l: 'Exact'    },
    { v: 'itemized',   l: 'Itemized' },
  ]
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4,
      padding: 4, borderRadius: 14, background: T.surfaceAlt,
      boxShadow: `inset 0 0 0 0.5px ${T.line}`,
    }}>
      {tabs.map(tab => {
        const on = value === tab.v
        return (
          <button key={tab.v} type="button" onClick={() => onChange(tab.v)} style={{
            border: 0, cursor: 'pointer', padding: '8px 6px',
            background: on ? T.ink : 'transparent',
            color: on ? T.bg : T.inkMuted,
            borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 600,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.l}</button>
        )
      })}
    </div>
  )
}

// Balanced/remaining pill — used by both DesktopSplitList and ExpenseBreakdown.
function RemainderCounter({ label, value, valid }: { label: string; value: string; valid: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 12,
      background: valid ? T.mintSoft : T.coralSoft,
      color: valid ? T.mintInk : T.coralInk,
      fontSize: 13, fontWeight: 600,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: valid ? T.mint : T.coral, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, flexShrink: 0,
      }}>{valid ? '✓' : '!'}</span>
      <div style={{ flex: 1 }}>{label}</div>
      <div style={{ fontFamily: FMONO, fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
  )
}

// ── Desktop components ───────────────────────────────────────────────────────

// Unified desktop split list — replaces the separate ModeEqual / ModePercent /
// ModeExact components. Itemized shows a coming-soon placeholder.
function DesktopSplitList({
  mode, total, memberIds, memberById, included, onToggle, youMemberId,
  percents, onPercentChange, exactAmounts, onExactChange, focusId, onFocus, onBlur,
}: {
  mode: SplitMode
  total: number
  memberIds: string[]
  memberById: Record<string, GroupMember>
  included: Set<string>
  onToggle: (id: string) => void
  youMemberId?: string
  percents: Record<string, string>
  onPercentChange: (id: string, val: string) => void
  exactAmounts: Record<string, string>
  onExactChange: (id: string, val: string) => void
  focusId: string | null
  onFocus: (id: string) => void
  onBlur: () => void
}) {
  if (mode === 'itemized') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>🧾</div>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: T.ink }}>Itemized splits</div>
        <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.5, maxWidth: 260 }}>
          Assign individual items to people. Scan a receipt or enter items manually. Coming soon.
        </div>
      </div>
    )
  }

  const share = included.size > 0 ? Math.round((total / included.size) * 100) / 100 : 0

  const pctSum = memberIds.reduce((a, id) => a + (parseFloat(percents[id] || '0') || 0), 0)
  const pctRemaining = Math.round((100 - pctSum) * 100) / 100
  const pctValid = Math.abs(pctRemaining) < 0.005

  const exactSumVal = memberIds.reduce((a, id) => a + (parseFloat(exactAmounts[id] || '0') || 0), 0)
  const exactRemaining = Math.round((total - exactSumVal) * 100) / 100
  const exactValid = Math.abs(exactRemaining) < 0.005

  const header =
    mode === 'equal'      ? `Splitting $${total.toFixed(2)} equally — ${included.size} of ${memberIds.length}` :
    mode === 'percentage' ? 'Split by percentage' :
                            'Split by exact amount'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted, padding: '0 4px 8px' }}>
        {header}
      </div>
      <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, overflow: 'hidden' }}>
        {memberIds.map((id, i) => {
          const m = memberById[id]
          const on = included.has(id)
          const isFocus = focusId === id
          const pct = parseFloat(percents[id] || '0') || 0
          const exactAmt = parseFloat(exactAmounts[id] || '0') || 0
          const pctOfTotal = total ? Math.round((exactAmt / total) * 100) : 0
          const dollars = total ? (total * pct / 100) : 0

          return (
            <div
              key={id}
              onClick={() => { if (mode === 'equal') onToggle(id) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: mode === 'equal' ? '12px 14px' : '11px 14px',
                borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}`,
                opacity: mode === 'equal' && !on ? 0.4 : 1,
                cursor: mode === 'equal' ? 'pointer' : 'default',
                background: mode !== 'equal' && isFocus ? T.surfaceAlt : 'transparent',
              }}
            >
              <Avatar profile={m ? avatarProfile(m) : undefined} slot={(i % 4) as 0|1|2|3} size={mode === 'equal' ? 32 : 30} isYou={m?.id === youMemberId} />

              {mode === 'equal' ? (
                <>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(m, youMemberId)}</div>
                  <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 600, letterSpacing: -0.4, color: on ? T.ink : T.inkFaint }}>
                    {on ? `$${share.toFixed(2)}` : '—'}
                  </div>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: on ? T.ink : 'transparent',
                    boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${T.lineStrong}`,
                    color: T.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, flexShrink: 0,
                  }}>{on ? '✓' : ''}</span>
                </>
              ) : mode === 'percentage' ? (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(m, youMemberId)}</div>
                    <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 1 }}>${dollars.toFixed(2)}</div>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 1,
                    padding: '8px 12px', borderRadius: 10, background: T.bg,
                    boxShadow: isFocus ? `inset 0 0 0 1.5px ${T.sun}` : `inset 0 0 0 1px ${T.line}`,
                    minWidth: 88, justifyContent: 'flex-end',
                  }}>
                    <input
                      type="number" inputMode="decimal" min={0}
                      value={percents[id] ?? ''}
                      onChange={e => onPercentChange(id, stripNegative(e.target.value))}
                      onFocus={() => onFocus(id)} onBlur={onBlur}
                      placeholder="0"
                      style={{ width: 48, border: 'none', outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 19, fontWeight: 600, letterSpacing: -0.4, color: T.ink, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 14, color: T.inkMuted, marginLeft: 2 }}>%</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(m, youMemberId)}</div>
                    <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{pctOfTotal}% of total</div>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 2,
                    padding: '8px 12px', borderRadius: 10, background: T.bg,
                    boxShadow: isFocus ? `inset 0 0 0 1.5px ${T.sun}` : `inset 0 0 0 1px ${T.line}`,
                    minWidth: 108, justifyContent: 'flex-end',
                  }}>
                    <span style={{ fontSize: 14, color: T.inkMuted }}>$</span>
                    <input
                      type="number" inputMode="decimal" min={0}
                      value={exactAmounts[id] ?? ''}
                      onChange={e => onExactChange(id, stripNegative(e.target.value))}
                      onFocus={() => onFocus(id)} onBlur={onBlur}
                      placeholder="0.00"
                      style={{ width: 64, border: 'none', outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 19, fontWeight: 600, letterSpacing: -0.4, color: T.ink, textAlign: 'right' }}
                    />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {mode === 'percentage' && (
        <RemainderCounter
          valid={pctValid}
          label={pctValid ? 'Adds up to 100%' : pctRemaining > 0 ? 'Remaining' : 'Over by'}
          value={pctValid ? '0%' : `${pctRemaining > 0 ? '' : '−'}${Math.abs(pctRemaining).toFixed(0)}%`}
        />
      )}
      {mode === 'exact' && (
        <RemainderCounter
          valid={exactValid}
          label={exactValid ? 'Balanced — ready to save' : exactRemaining > 0 ? 'Remaining' : 'Over by'}
          value={exactValid ? '$0.00' : `${exactRemaining > 0 ? '' : '−'}$${Math.abs(exactRemaining).toFixed(2)}`}
        />
      )}
    </div>
  )
}

function PaidByChips({
  members, memberById, paidById, onSelect, youMemberId, compact,
}: {
  members: GroupMember[]
  memberById: Record<string, GroupMember>
  paidById: string | null
  onSelect: (id: string) => void
  youMemberId?: string
  compact?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap', justifyContent: compact ? 'flex-end' : 'flex-start' }}>
      {members.map((m, i) => {
        const member = memberById[m.id]
        const on = paidById === m.id
        return (
          <button
            key={m.id} type="button" onClick={() => onSelect(m.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: compact ? (on ? '3px 9px 3px 3px' : 3) : '4px 11px 4px 4px',
              borderRadius: 999,
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.ink,
              boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: F,
            }}
          >
            <Avatar profile={member ? avatarProfile(member) : undefined} slot={(i % 4) as 0|1|2|3} size={22} isYou={m.id === youMemberId} />
            {(!compact || on) && <span>{shortName(member, youMemberId)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function CategoryChips({ category, onSelect }: { category: string; onSelect: (emoji: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {CATEGORIES.map(cat => {
        const on = category === cat.emoji
        return (
          <button
            key={cat.emoji} type="button" onClick={() => onSelect(cat.emoji)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px 4px 8px', borderRadius: 999,
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.ink,
              boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
              border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: F,
            }}
          >
            <span style={{ fontSize: 12 }}>{cat.emoji}</span>
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}

// Footer status — tells the user what's blocking Save. Mobile shows RemainderCounter inline instead.
function FooterStatusHint({
  splitMode, amt, included, percentValid, exactValid,
}: {
  splitMode: SplitMode; amt: number; included: Set<string>; percentValid: boolean; exactValid: boolean
}) {
  const share = included.size > 0 ? Math.round((amt / included.size) * 100) / 100 : 0
  if (splitMode === 'equal' && included.size > 0 && amt > 0) {
    return (
      <span>
        Each pays <b style={{ color: T.ink, fontFamily: FMONO }}>${share.toFixed(2)}</b>
        {' · '}{included.size} {included.size === 1 ? 'person' : 'people'}
      </span>
    )
  }
  if (splitMode === 'percentage') return percentValid
    ? <span style={{ color: T.mintInk, fontWeight: 700 }}>✓ Adds up to 100%</span>
    : <span style={{ color: T.coralInk, fontWeight: 700 }}>! Doesn&apos;t sum to 100%</span>
  if (splitMode === 'exact') return exactValid
    ? <span style={{ color: T.mintInk, fontWeight: 700 }}>✓ Balanced</span>
    : <span style={{ color: T.coralInk, fontWeight: 700 }}>! Doesn&apos;t sum to total</span>
  if (splitMode === 'itemized') return <span>Itemized splits coming soon</span>
  return null
}

function SaveFooter({
  onCancel, onSave, canSave, saveLabel, isPending, showStatus, statusHint,
}: {
  onCancel: () => void; onSave: () => void; canSave: boolean; saveLabel: string
  isPending: boolean; showStatus: boolean; statusHint: ReactNode
}) {
  return (
    <footer className="add-expense-desktop-footer">
      {showStatus && (
        <div style={{ fontSize: 12, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 10 }}>
          {statusHint}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button
          type="button" onClick={onCancel}
          style={{ padding: '10px 16px', borderRadius: 10, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', fontFamily: F, fontSize: 13, fontWeight: 700 }}
        >Cancel</button>
        <button
          type="button" onClick={onSave} disabled={!canSave || isPending}
          style={{
            padding: '10px 20px', borderRadius: 10,
            background: canSave ? T.sun : T.lineStrong,
            color: canSave ? T.sunInk : T.inkFaint,
            border: 0, cursor: canSave && !isPending ? 'pointer' : 'default',
            fontFamily: FH, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
            boxShadow: canSave ? '0 6px 16px rgba(242,192,74,0.32)' : 'none',
          }}
        >{saveLabel}</button>
      </div>
    </footer>
  )
}

// ── Mobile components ────────────────────────────────────────────────────────

function Hairline() {
  return <div style={{ height: 0.5, background: T.line, flexShrink: 0 }} />
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={13} height={13} viewBox="0 0 14 14" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
      <path d="M5 3l4 4-4 4" stroke={open ? T.sun : T.lineStrong} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CollapsibleRow({ label, value, open, onClick }: {
  label: string; value: ReactNode; open: boolean; onClick: () => void
}) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', padding: '15px 0', background: 'none', border: 'none', width: '100%', cursor: 'pointer', fontFamily: F, textAlign: 'left' }}
    >
      <span style={{ fontSize: 15, fontWeight: 600, color: T.ink, flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {value}
        <Chevron open={open} />
      </div>
    </button>
  )
}

function PayerPillRow({
  members, memberById, slotById, paidById, onSelect, youMemberId,
}: {
  members: GroupMember[]; memberById: Record<string, GroupMember>; slotById: Record<string, 0|1|2|3>
  paidById: string | null; onSelect: (id: string) => void; youMemberId?: string
}) {
  return (
    <div style={{ paddingBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {members.map(m => {
          const sel = paidById === m.id
          return (
            <button
              key={m.id} type="button" onClick={() => onSelect(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                padding: '7px 13px 7px 7px', borderRadius: 999,
                border: `2px solid ${sel ? T.sun : T.line}`,
                background: sel ? T.sunSoft : T.surface,
                cursor: 'pointer', fontFamily: F, transition: 'all 0.15s',
              }}
            >
              <Avatar profile={memberById[m.id] ? avatarProfile(memberById[m.id]) : undefined} slot={slotById[m.id] ?? 0} size={24} isYou={m.id === youMemberId} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: sel ? T.sunInk : T.ink, whiteSpace: 'nowrap' }}>
                {shortName(memberById[m.id], youMemberId)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ALGORITHMS: { id: SplitMode; label: string; desc: string }[] = [
  { id: 'equal',      label: 'Equal',         desc: 'Divided evenly among everyone' },
  { id: 'exact',      label: 'Exact amounts', desc: 'Enter a specific amount per person' },
  { id: 'percentage', label: 'Percentages',   desc: 'Each person pays a % of the total' },
  { id: 'itemized',   label: 'By items',      desc: 'Assign receipt items to people' },
]

function algoLabel(splitMode: SplitMode) {
  return ALGORITHMS.find(a => a.id === splitMode)?.label ?? 'Equal'
}

// Whole numbers stay clean ("5%"); fractional remainders keep one decimal.
function fmtPct(n: number) {
  return Number.isInteger(Math.round(n * 10) / 10) ? n.toFixed(0) : n.toFixed(1)
}

// Expanded "Split" row content — algorithm picker only. Selecting closes the panel.
function AlgorithmRadios({ splitMode, onSelect }: { splitMode: SplitMode; onSelect: (m: SplitMode) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ALGORITHMS.map((algo, idx) => {
        const sel = splitMode === algo.id
        const isLast = idx === ALGORITHMS.length - 1
        return (
          <div
            key={algo.id} onClick={() => onSelect(algo.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderBottom: isLast ? 'none' : `0.5px solid ${T.line}`, cursor: 'pointer' }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${sel ? T.sun : T.lineStrong}`,
              background: sel ? T.sun : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.14s',
            }}>
              {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.sunInk }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: sel ? 700 : 500, color: T.ink }}>{algo.label}</div>
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 1 }}>{algo.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Checkbox({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${on ? T.sun : T.lineStrong}`,
        background: on ? T.sun : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.14s',
        fontSize: 11, fontWeight: 800, color: T.sunInk,
      }}
    >{on ? '✓' : ''}</div>
  )
}

// Avatar + name for one Expense Details row. Payer rows are non-interactive.
function PersonLabel({
  m, id, slotById, payerId, youMemberId, onClick,
}: {
  m: GroupMember | undefined; id: string; slotById: Record<string, 0|1|2|3>
  payerId: string; youMemberId?: string; onClick: () => void
}) {
  const isPayer = id === payerId
  return (
    <div
      onClick={() => { if (!isPayer) onClick() }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: isPayer ? 'default' : 'pointer', minWidth: 0 }}
    >
      <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotById[id] ?? 0} size={30} isYou={id === youMemberId} />
      <span style={{ fontSize: 15, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {shortName(m, youMemberId)}
      </span>
    </div>
  )
}

// Mobile "Expense Details" for equal/exact/percentage.
// Balance semantics: equal divides total across all included; exact/% only
// requires OTHER members to balance — payer's share is the remainder in handleSave.
function ExpenseBreakdown({
  splitMode, memberIds, memberById, slotById, payerId, total,
  included, onToggle, youMemberId, exactAmounts, onExactChange, percents, onPercentChange,
}: {
  splitMode: 'equal' | 'exact' | 'percentage'
  memberIds: string[]; memberById: Record<string, GroupMember>; slotById: Record<string, 0|1|2|3>
  payerId: string; total: number; included: Set<string>; onToggle: (id: string) => void
  youMemberId?: string; exactAmounts: Record<string, string>; onExactChange: (id: string, v: string) => void
  percents: Record<string, string>; onPercentChange: (id: string, v: string) => void
}) {
  const activeCount = memberIds.filter(id => included.has(id)).length
  const per = activeCount > 0 ? Math.round((total / activeCount) * 100) / 100 : 0
  const others = memberIds.filter(id => id !== payerId)

  let remainder: { valid: boolean; label: string; value: string } | null = null
  if (splitMode === 'exact') {
    const assigned = others.filter(id => included.has(id)).reduce((s, id) => s + (parseFloat(exactAmounts[id] || '0') || 0), 0)
    const diff = Math.round((total - assigned) * 100) / 100
    const balanced = Math.abs(diff) < 0.01
    remainder = {
      valid: balanced,
      label: balanced ? 'Balanced — ready to save' : diff > 0 ? 'Remaining' : 'Over by',
      value: balanced ? '$0.00' : `${diff > 0 ? '' : '−'}$${Math.abs(diff).toFixed(2)}`,
    }
  } else if (splitMode === 'percentage') {
    const pctSum = others.filter(id => included.has(id)).reduce((s, id) => s + (parseFloat(percents[id] || '0') || 0), 0)
    const balanced = Math.abs(pctSum - 100) < 0.005
    remainder = {
      valid: balanced,
      label: balanced ? 'Adds up to 100%' : pctSum > 100 ? 'Over by' : 'Remaining',
      value: balanced ? '0%' : `${pctSum > 100 ? '−' : ''}${fmtPct(Math.abs(100 - pctSum))}%`,
    }
  }

  return (
    <>
      {memberIds.map((id, idx) => {
        const m = memberById[id]
        const isPayer = id === payerId
        const on = included.has(id)
        const isLast = idx === memberIds.length - 1
        const pct = parseFloat(percents[id] || '0') || 0
        const rowAmt = on ? (isPayer ? total : per) : 0

        return (
          <div key={id} style={{
            display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0',
            borderBottom: isLast ? 'none' : `0.5px solid ${T.line}`,
            opacity: on ? 1 : 0.35, transition: 'opacity 0.15s',
          }}>
            {isPayer
              ? <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.bg }} />
                </div>
              : <Checkbox on={on} onClick={() => onToggle(id)} />
            }
            <PersonLabel m={m} id={id} slotById={slotById} payerId={payerId} youMemberId={youMemberId} onClick={() => onToggle(id)} />
            {splitMode === 'equal' ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: on ? T.ink : T.inkFaint }}>${rowAmt.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>{isPayer ? 'paid' : on ? 'owes' : '—'}</div>
              </div>
            ) : isPayer ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: T.ink }}>${total.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>paid</div>
              </div>
            ) : splitMode === 'exact' ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: on ? T.surfaceAlt : 'transparent', padding: '6px 10px', borderRadius: 10, border: on ? `0.5px solid ${T.line}` : 'none' }}>
                <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: FH }}>$</span>
                <input
                  type="number" inputMode="decimal" min={0} disabled={!on}
                  value={on ? (exactAmounts[id] ?? '') : ''}
                  onChange={e => onExactChange(id, stripNegative(e.target.value))}
                  placeholder="0.00"
                  style={{ border: 'none', background: 'none', width: 52, textAlign: 'right', fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: T.ink, outline: 'none', padding: 0 }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: on ? T.surfaceAlt : 'transparent', padding: '5px 9px', borderRadius: 10, border: on ? `0.5px solid ${T.line}` : 'none' }}>
                  <input
                    type="number" inputMode="decimal" min={0} disabled={!on}
                    value={on ? (percents[id] ?? '') : ''}
                    onChange={e => onPercentChange(id, stripNegative(e.target.value))}
                    placeholder="0"
                    style={{ border: 'none', background: 'none', width: 34, textAlign: 'right', fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: T.ink, outline: 'none', padding: 0 }}
                  />
                  <span style={{ fontSize: 12, color: T.inkMuted }}>%</span>
                </div>
                <span style={{ fontFamily: FMONO, fontSize: 10, color: T.inkFaint }}>${(on ? total * pct / 100 : 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        )
      })}
      {remainder && (
        <div style={{ paddingTop: 10 }}>
          <RemainderCounter valid={remainder.valid} label={remainder.label} value={remainder.value} />
        </div>
      )}
    </>
  )
}

// Mobile itemized receipt builder. UI-only preview — nothing reaches handleSave.
function BreakdownItems({
  memberIds, memberById, slotById, items, onAddItem, onRemoveItem, onRenameItem, onPriceItem, onToggleAssign,
  taxMode, setTaxMode, taxVal, setTaxVal, taxAmt,
  tipMode, setTipMode, tipVal, setTipVal, tipAmt,
  subtotal, itemTotal, youMemberId,
}: {
  memberIds: string[]; memberById: Record<string, GroupMember>; slotById: Record<string, 0|1|2|3>
  items: LineItem[]; onAddItem: () => void; onRemoveItem: (id: number) => void
  onRenameItem: (id: number, name: string) => void; onPriceItem: (id: number, price: number) => void
  onToggleAssign: (id: number, memberId: string) => void
  taxMode: 'percent'|'flat'; setTaxMode: (m: 'percent'|'flat') => void; taxVal: number; setTaxVal: (v: number) => void; taxAmt: number
  tipMode: 'percent'|'flat'; setTipMode: (m: 'percent'|'flat') => void; tipVal: number; setTipVal: (v: number) => void; tipAmt: number
  subtotal: number; itemTotal: number; youMemberId?: string
}) {
  const rows: TaxTipRow[] = [
    { label: 'Tax', mode: taxMode, setMode: setTaxMode, val: taxVal, setVal: setTaxVal, amt: taxAmt },
    { label: 'Tip', mode: tipMode, setMode: setTipMode, val: tipVal, setVal: setTipVal, amt: tipAmt },
  ]

  return (
    <>
      {items.map(it => (
        <div key={it.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: `0.5px solid ${T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={it.name} onChange={e => onRenameItem(it.id, e.target.value)} placeholder="Item name"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink, caretColor: T.sun, minWidth: 0 }}
            />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.surfaceAlt, padding: '4px 9px', borderRadius: 9, border: `0.5px solid ${T.line}`, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: FH }}>$</span>
              <input
                type="number" inputMode="decimal" min={0} value={it.price || ''}
                onChange={e => onPriceItem(it.id, Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ border: 'none', background: 'none', width: 44, textAlign: 'right', fontFamily: FMONO, fontSize: 13, fontWeight: 700, color: T.ink, outline: 'none', padding: 0 }}
                placeholder="0.00"
              />
            </div>
            <button type="button" onClick={() => onRemoveItem(it.id)} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.3, flexShrink: 0 }}>
              <svg width={12} height={12} viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M5 4V2.5h4V4M5.5 6v5M8.5 6v5M3 4l.8 7.5h6.4L11 4" stroke={T.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {memberIds.map(id => {
              const on = it.assignedTo.includes(id)
              return (
                <button
                  key={id} type="button" onClick={() => onToggleAssign(it.id, id)}
                  style={{ padding: 0, background: 'none', border: `2px solid ${on ? T.sun : 'transparent'}`, borderRadius: '50%', cursor: 'pointer', opacity: on ? 1 : 0.25, transition: 'all 0.13s', flexShrink: 0 }}
                >
                  <Avatar profile={memberById[id] ? avatarProfile(memberById[id]) : undefined} slot={slotById[id] ?? 0} size={28} isYou={id === youMemberId} />
                </button>
              )
            })}
            {it.assignedTo.length > 1 && (
              <span style={{ fontSize: 10, color: T.inkFaint, fontFamily: FMONO, marginLeft: 2, whiteSpace: 'nowrap' }}>
                ÷{it.assignedTo.length} = ${(it.price / it.assignedTo.length).toFixed(2)}/ea
              </span>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={onAddItem} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '4px 0 12px', cursor: 'pointer', fontFamily: F, color: T.sun }}>
        <svg width={12} height={12} viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke={T.sun} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Add item</span>
      </button>

      <div style={{ borderTop: `0.5px solid ${T.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `0.5px solid ${T.line}` }}>
          <span style={{ fontSize: 13, color: T.inkMuted, fontWeight: 500 }}>Subtotal</span>
          <span style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
        </div>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: `0.5px solid ${T.line}` }}>
            <span style={{ fontSize: 13, color: T.inkMuted, fontWeight: 500, flex: 1 }}>{row.label}</span>
            <div style={{ display: 'flex', background: T.surfaceAlt, borderRadius: 999, padding: 2, gap: 1, border: `0.5px solid ${T.line}` }}>
              {(['percent', 'flat'] as const).map(opt => {
                const sel = row.mode === opt
                return (
                  <button
                    key={opt} type="button" onClick={() => row.setMode(opt)}
                    style={{ padding: '2px 8px', borderRadius: 999, border: 'none', background: sel ? T.surface : 'none', fontSize: 11, fontWeight: sel ? 700 : 500, color: sel ? T.ink : T.inkMuted, cursor: 'pointer', fontFamily: F, boxShadow: sel ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}
                  >{opt === 'percent' ? '%' : '$'}</button>
                )
              })}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.surfaceAlt, padding: '3px 8px', borderRadius: 8, border: `0.5px solid ${T.line}` }}>
              {row.mode === 'flat' && <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: FH }}>$</span>}
              <input
                type="number" inputMode="decimal" min={0} value={row.val}
                onChange={e => row.setVal(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ border: 'none', background: 'none', width: 36, textAlign: 'right', fontFamily: FMONO, fontSize: 13, fontWeight: 600, color: T.ink, outline: 'none', padding: 0 }}
              />
              {row.mode === 'percent' && <span style={{ fontSize: 11, color: T.inkMuted }}>%</span>}
            </div>
            <span style={{ fontFamily: FMONO, fontSize: 12, color: T.inkMuted, minWidth: 44, textAlign: 'right' }}>${row.amt.toFixed(2)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total</span>
          <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: T.ink }}>${itemTotal.toFixed(2)}</span>
        </div>
      </div>
    </>
  )
}

// ── Main form ────────────────────────────────────────────────────────────────

interface AddExpenseFormProps {
  groupId: string
  onSuccess: () => void
  onCancel: () => void
}

export function AddExpenseForm({ groupId, onSuccess, onCancel }: AddExpenseFormProps) {
  const isMobile = useIsMobileSheet()
  const { data: group }        = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const { data: profile }      = useCurrentProfile()
  const addExpense             = useAddExpense(groupId)

  const [amount,         setAmount]         = useState('')
  const [description,    setDescription]    = useState('')
  const [category,       setCategory]       = useState('💸')
  const [manualCategory, setManualCategory] = useState(false)
  const [splitMode,      setSplitMode]      = useState<SplitMode>('equal')
  const [paidById,       setPaidById]       = useState<string | null>(null)
  const [expenseDate,    setExpenseDate]    = useState(new Date().toISOString().split('T')[0])
  const [included,       setIncluded]       = useState<Set<string>>(new Set())
  const [percents,       setPercents]       = useState<Record<string, string>>({})
  const [exactAmounts,   setExactAmounts]   = useState<Record<string, string>>({})
  const [focusId,        setFocusId]        = useState<string | null>(null)
  const [openPanel,      setOpenPanel]      = useState<'payer' | 'split' | null>(null)

  // Itemized builder state — UI-only preview, nothing reaches handleSave
  const [items,    setItems]    = useState<LineItem[]>([])
  const [taxMode,  setTaxMode]  = useState<'percent' | 'flat'>('percent')
  const [taxVal,   setTaxVal]   = useState(0)
  const [tipMode,  setTipMode]  = useState<'percent' | 'flat'>('percent')
  const [tipVal,   setTipVal]   = useState(0)
  const nextItemId = useRef(0)

  const memberIds   = members.map(m => m.id)
  const memberById  = Object.fromEntries(members.map(m => [m.id, m as GroupMember]))
  const slotById    = Object.fromEntries(members.map((m, i) => [m.id, (i % 4) as 0|1|2|3]))
  const myMember    = members.find(m => m.user_id === profile?.id)
  const youMemberId = myMember?.id

  useEffect(() => {
    if (myMember && !paidById) setPaidById(myMember.id)
  }, [myMember?.id])

  useEffect(() => {
    if (members.length > 0 && included.size === 0) setIncluded(new Set(memberIds))
  }, [members.length])

  // Payer can never be excluded from their own expense
  useEffect(() => {
    if (!paidById) return
    setIncluded(prev => prev.has(paidById) ? prev : new Set(prev).add(paidById))
  }, [paidById])

  useEffect(() => {
    if (!manualCategory && description) setCategory(detectCategory(description))
  }, [description, manualCategory])

  function toggleIncluded(id: string) {
    setIncluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  function selectCategory(emoji: string) {
    setCategory(emoji)
    setManualCategory(true)
  }

  const amt = parseFloat(amount) || 0

  // Desktop: payer is one of the amounts-mode rows, whole included set must balance.
  // Mobile: payer never gets an editable field — only OTHER members need to balance.
  const amountsIds   = isMobile && paidById ? [...included].filter(id => id !== paidById) : [...included]
  const percentSum   = amountsIds.reduce((a, id) => a + (parseFloat(percents[id] || '0') || 0), 0)
  const exactSum     = amountsIds.reduce((a, id) => a + (parseFloat(exactAmounts[id] || '0') || 0), 0)
  const percentValid = Math.abs(percentSum - 100) < 0.005
  const exactValid   = amt > 0 && Math.abs(exactSum - amt) < 0.005

  // Pre-fill inputs with an even split when opening percent/exact mode
  useEffect(() => {
    if (splitMode !== 'exact' && splitMode !== 'percentage') return
    const ids = memberIds.filter(id => included.has(id) && (!isMobile || id !== paidById))
    if (ids.length === 0) return
    if (splitMode === 'exact') {
      setExactAmounts(prev => {
        const missing = ids.filter(id => prev[id] === undefined)
        if (missing.length === 0) return prev
        const share = amt / ids.length
        const next = { ...prev }
        missing.forEach(id => { next[id] = share.toFixed(2) })
        return next
      })
    } else {
      setPercents(prev => {
        const missing = ids.filter(id => prev[id] === undefined)
        if (missing.length === 0) return prev
        const share = 100 / ids.length
        const next = { ...prev }
        missing.forEach(id => { next[id] = share.toFixed(1) })
        return next
      })
    }
  }, [splitMode])

  const baseValid = !!description.trim() && amt > 0 && !!paidById
  const canSave = baseValid && (
    splitMode === 'equal'      ? included.size > 0 :
    splitMode === 'percentage' ? percentValid :
    splitMode === 'exact'      ? exactValid :
    false
  )

  const saveLabel = addExpense.isPending ? 'Saving…' :
    !baseValid                                  ? 'Save expense' :
    splitMode === 'percentage' && !percentValid ? 'Balance to 100% first' :
    splitMode === 'exact'      && !exactValid   ? "Doesn't add up yet" :
    splitMode === 'itemized'                    ? 'Coming soon' :
    'Save expense'

  async function handleSave() {
    if (!canSave || addExpense.isPending || !paidById) return
    const roundedAmt = Math.round(amt * 100) / 100
    const others = isMobile ? [...included].filter(id => id !== paidById) : []

    let splits: { group_member_id: string; owed_amount: number }[]
    let splitType: 'equal' | 'percentage' | 'exact'

    if (splitMode === 'equal') {
      splits    = makeEqualSplits('', roundedAmt, [...included]).map(s => ({ group_member_id: s.group_member_id, owed_amount: s.owed_amount }))
      splitType = 'equal'
    } else if (splitMode === 'percentage') {
      const percentInputs = isMobile
        ? [
            { group_member_id: paidById, percent: Math.max(0, 100 - others.reduce((s, id) => s + (parseFloat(percents[id] || '0') || 0), 0)) },
            ...others.map(id => ({ group_member_id: id, percent: parseFloat(percents[id] || '0') || 0 })),
          ]
        : [...included].map(id => ({ group_member_id: id, percent: parseFloat(percents[id] || '0') || 0 }))
      splits    = makePercentSplits('', roundedAmt, percentInputs).map(s => ({ group_member_id: s.group_member_id, owed_amount: s.owed_amount }))
      splitType = 'percentage'
    } else {
      const exactInputs = isMobile
        ? [
            { group_member_id: paidById, owed_amount: Math.round((roundedAmt - others.reduce((s, id) => s + (parseFloat(exactAmounts[id] || '0') || 0), 0)) * 100) / 100 },
            ...others.map(id => ({ group_member_id: id, owed_amount: parseFloat(exactAmounts[id] || '0') || 0 })),
          ]
        : [...included].map(id => ({ group_member_id: id, owed_amount: parseFloat(exactAmounts[id] || '0') || 0 }))
      splits    = makeExactSplits('', exactInputs).map(s => ({ group_member_id: s.group_member_id, owed_amount: s.owed_amount }))
      splitType = 'exact'
    }

    await addExpense.mutateAsync({
      description: description.trim(),
      amount: roundedAmt,
      paid_by: paidById,
      split_type: splitType,
      splits,
      category,
      expense_date: expenseDate,
    })
    onSuccess()
  }

  const groupLabel = group ? `${group.emoji} ${group.name}` : '…'

  // ── Mobile render ──────────────────────────────────────────────────────────
  if (isMobile) {
    const payer = paidById ? memberById[paidById] : undefined
    const isItemized = splitMode === 'itemized'
    const subtotal  = items.reduce((s, it) => s + it.price, 0)
    const taxAmt    = taxMode === 'percent' ? Math.round(subtotal * taxVal / 100 * 100) / 100 : taxVal
    const tipAmt    = tipMode === 'percent' ? Math.round(subtotal * tipVal / 100 * 100) / 100 : tipVal
    const itemTotal = Math.round((subtotal + taxAmt + tipAmt) * 100) / 100
    const mobileSaveLabel = addExpense.isPending ? 'Saving…' : isItemized ? 'Itemized — coming soon' : 'Save expense'

    return (
      <div className="add-expense-panel add-expense-panel--mobile">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 8px', flexShrink: 0 }}>
          <button
            type="button" onClick={onCancel}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: F, fontSize: 15, fontWeight: 600, color: T.inkMuted, padding: '6px 4px' }}
          >Cancel</button>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkMuted, background: T.surfaceAlt, padding: '4px 12px', borderRadius: 999 }}>
            {groupLabel}
          </div>
          <div style={{ width: 56 }} />
        </div>

        <div className="add-expense-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
          <input
            type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What was it for?"
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: FH, fontSize: 21, fontWeight: 700, letterSpacing: -0.5, color: T.ink, padding: '0 0 6px', caretColor: T.sun, width: '100%' }}
          />

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, paddingBottom: 18 }}>
            <span style={{ fontFamily: FH, fontSize: 24, fontWeight: 500, color: T.inkMuted }}>$</span>
            {isItemized ? (
              <span style={{ fontFamily: FH, fontSize: 38, fontWeight: 800, letterSpacing: -1.5, color: itemTotal > 0 ? T.ink : T.inkFaint }}>
                {itemTotal > 0 ? itemTotal.toFixed(2) : '0.00'}
              </span>
            ) : (
              <input
                type="number" inputMode="decimal" min={0} value={amount} onChange={e => setAmount(stripNegative(e.target.value))}
                placeholder="0.00"
                className="add-expense-amount-input"
                style={{ background: 'none', border: 'none', outline: 'none', fontFamily: FH, fontSize: 38, fontWeight: 800, letterSpacing: -1.5, color: T.ink, width: '100%', caretColor: T.sun }}
              />
            )}
            {isItemized && <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 6, alignSelf: 'flex-end', paddingBottom: 5 }}>from receipt</span>}
          </div>

          <Hairline />

          <CollapsibleRow
            label="Paid by" open={openPanel === 'payer'}
            onClick={() => setOpenPanel(p => p === 'payer' ? null : 'payer')}
            value={
              <>
                <Avatar profile={payer ? avatarProfile(payer) : undefined} slot={paidById ? (slotById[paidById] ?? 0) : 0} size={22} isYou={paidById === youMemberId} />
                <span style={{ fontSize: 15, fontWeight: 500, color: openPanel === 'payer' ? T.sun : T.inkMuted }}>
                  {shortName(payer, youMemberId)}
                </span>
              </>
            }
          />
          {openPanel === 'payer' && (
            <PayerPillRow
              members={members as GroupMember[]} memberById={memberById} slotById={slotById}
              paidById={paidById} onSelect={setPaidById} youMemberId={youMemberId}
            />
          )}

          <Hairline />

          <CollapsibleRow
            label="Split" open={openPanel === 'split'}
            onClick={() => setOpenPanel(p => p === 'split' ? null : 'split')}
            value={
              <span style={{ fontSize: 15, fontWeight: 500, color: openPanel === 'split' ? T.sun : T.inkMuted }}>
                {algoLabel(splitMode)}
              </span>
            }
          />
          {openPanel === 'split' && (
            <div style={{ paddingBottom: 10 }}>
              <AlgorithmRadios splitMode={splitMode} onSelect={m => { setSplitMode(m); setOpenPanel(null) }} />
            </div>
          )}

          <Hairline />

          {(isItemized || amt > 0) && (
            <>
              <div style={{ padding: '14px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', color: T.inkFaint, marginBottom: 10 }}>
                  Expense Details
                </div>
                {!paidById ? null : splitMode === 'itemized' ? (
                  <BreakdownItems
                    memberIds={memberIds} memberById={memberById} slotById={slotById}
                    items={items}
                    onAddItem={() => setItems(prev => [...prev, { id: ++nextItemId.current, name: '', price: 0, assignedTo: [...memberIds] }])}
                    onRemoveItem={id => setItems(prev => prev.filter(it => it.id !== id))}
                    onRenameItem={(id, name) => setItems(prev => prev.map(it => it.id === id ? { ...it, name } : it))}
                    onPriceItem={(id, price) => setItems(prev => prev.map(it => it.id === id ? { ...it, price } : it))}
                    onToggleAssign={(id, memberId) => setItems(prev => prev.map(it => {
                      if (it.id !== id) return it
                      const has = it.assignedTo.includes(memberId)
                      return { ...it, assignedTo: has ? it.assignedTo.filter(x => x !== memberId) : [...it.assignedTo, memberId] }
                    }))}
                    taxMode={taxMode} setTaxMode={setTaxMode} taxVal={taxVal} setTaxVal={setTaxVal} taxAmt={taxAmt}
                    tipMode={tipMode} setTipMode={setTipMode} tipVal={tipVal} setTipVal={setTipVal} tipAmt={tipAmt}
                    subtotal={subtotal} itemTotal={itemTotal} youMemberId={youMemberId}
                  />
                ) : (
                  <ExpenseBreakdown
                    splitMode={splitMode}
                    memberIds={memberIds} memberById={memberById} slotById={slotById}
                    payerId={paidById} total={amt} included={included} onToggle={toggleIncluded}
                    youMemberId={youMemberId}
                    exactAmounts={exactAmounts} onExactChange={(id, v) => setExactAmounts(p => ({ ...p, [id]: v }))}
                    percents={percents} onPercentChange={(id, v) => setPercents(p => ({ ...p, [id]: v }))}
                  />
                )}
              </div>
              <Hairline />
            </>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: '12px 18px 28px', background: T.surface }}>
          <button
            type="button" onClick={handleSave} disabled={!canSave || addExpense.isPending}
            style={{
              width: '100%', background: canSave ? T.sun : T.lineStrong, border: 'none', borderRadius: 14,
              padding: '17px', fontSize: 16, fontWeight: 700,
              color: canSave ? T.sunInk : T.inkFaint,
              boxShadow: canSave ? '0 4px 16px rgba(242,192,74,0.28)' : 'none',
              cursor: canSave && !addExpense.isPending ? 'pointer' : 'default',
              fontFamily: FH, letterSpacing: -0.2,
            }}
          >{mobileSaveLabel}</button>
        </div>
      </div>
    )
  }

  // ── Desktop render ─────────────────────────────────────────────────────────
  const statusHint = (
    <FooterStatusHint
      splitMode={splitMode} amt={amt} included={included}
      percentValid={percentValid} exactValid={exactValid}
    />
  )

  return (
    <div className="add-expense-panel add-expense-panel--desktop">
      <header className="add-expense-desktop-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted }}>
            New expense · {groupLabel}
          </div>
          <div style={{ marginTop: 3, fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.6, color: T.ink }}
            />
          </div>
        </div>
        <button
          type="button" onClick={onCancel} aria-label="Close"
          style={{ width: 36, height: 36, borderRadius: 12, background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: T.inkMuted, flexShrink: 0 }}
        >✕</button>
      </header>

      <div className="add-expense-desktop-body">
        <div className="add-expense-desktop-left">
          {/* Amount */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '14px 16px' }}>
            <div style={TILE_LABEL}>Amount</div>
            <div style={{ marginTop: 4, fontFamily: FH, fontSize: 38, fontWeight: 600, letterSpacing: -1.4, lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 20, color: T.inkMuted, fontWeight: 500 }}>$</span>
              <input
                type="number" inputMode="decimal" min={0}
                value={amount} onChange={e => setAmount(stripNegative(e.target.value))}
                placeholder="0.00"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 38, fontWeight: 600, letterSpacing: -1.4, color: T.ink }}
              />
            </div>
          </div>

          {/* Paid by */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px' }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Paid by</div>
            <PaidByChips members={members as GroupMember[]} memberById={memberById} paidById={paidById} onSelect={setPaidById} youMemberId={youMemberId} />
          </div>

          {/* Category */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px' }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Category</div>
            <CategoryChips category={category} onSelect={selectCategory} />
          </div>

          {/* Date */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px' }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Date</div>
            <input
              type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: T.r.md, border: `1px solid ${T.line}`, background: T.bg, fontSize: 14, fontFamily: F, color: T.ink, outline: 'none' }}
            />
          </div>
        </div>

        <div className="add-expense-desktop-right">
          <div style={{ paddingBottom: 12, flexShrink: 0 }}>
            <ModeTabs value={splitMode} onChange={setSplitMode} />
          </div>
          <div className="add-expense-scroll">
            <DesktopSplitList
              mode={splitMode} total={amt}
              memberIds={memberIds} memberById={memberById}
              included={included} onToggle={toggleIncluded}
              youMemberId={youMemberId}
              percents={percents} onPercentChange={(id, val) => setPercents(p => ({ ...p, [id]: val }))}
              exactAmounts={exactAmounts} onExactChange={(id, val) => setExactAmounts(p => ({ ...p, [id]: val }))}
              focusId={focusId} onFocus={setFocusId} onBlur={() => setFocusId(null)}
            />
          </div>
        </div>
      </div>

      <SaveFooter
        onCancel={onCancel} onSave={handleSave}
        canSave={canSave} saveLabel={saveLabel}
        isPending={addExpense.isPending}
        showStatus statusHint={statusHint}
      />
    </div>
  )
}

// ── Sheet wrapper ────────────────────────────────────────────────────────────

interface AddExpenseSheetProps {
  open: boolean
  onClose: () => void
  groupId: string
}

export function AddExpenseSheet({ open, onClose, groupId }: AddExpenseSheetProps) {
  const { data: group } = useGroup(groupId)
  const title = group ? `Add expense — ${group.name}` : 'Add expense'

  return (
    <ModalOrSheet
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={740}
      sheetContentClassName="add-expense-panel-root"
      sheetContentStyle={{ padding: 0, overflow: 'hidden' }}
      panelClassName="add-expense-panel-root"
      panelStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <AddExpenseForm groupId={groupId} onSuccess={onClose} onCancel={onClose} />
    </ModalOrSheet>
  )
}
