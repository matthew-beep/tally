'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { T, FH, F, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useAddExpense } from '@/queries/useExpenses'
import { useCurrentProfile } from '@/queries/useProfile'
import { detectCategory, CATEGORIES } from '@/lib/categories'
import { makeEqualSplits, makePercentSplits, makeExactSplits } from '@/lib/splits'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import type { Profile } from '@/types'

type SplitMode = 'equal' | 'percentage' | 'exact' | 'itemized'

const TILE_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
  textTransform: 'uppercase', color: T.inkMuted,
}

const TILE: React.CSSProperties = {
  background: T.surface, borderRadius: 16,
  border: `0.5px solid ${T.line}`, padding: '12px 14px',
}

function shortName(p: Profile | undefined, youId?: string) {
  if (!p) return '…'
  if (p.id === youId) return 'You'
  return (p.display_name ?? p.name).split(' ')[0]
}

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
            borderRadius: 10, fontFamily: F,
            fontSize: 13, fontWeight: 600,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.l}</button>
        )
      })}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return <div style={{ ...TILE_LABEL, padding: '0 4px 8px' }}>{label}</div>
}

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

function ModeEqual({
  total, memberIds, profileById, included, onToggle, youId, interactive = true,
}: {
  total: number
  memberIds: string[]
  profileById: Record<string, Profile>
  included: Set<string>
  onToggle: (id: string) => void
  youId?: string
  interactive?: boolean
}) {
  const count = included.size || 1
  const share = Math.round((total / count) * 100) / 100

  return (
    <div>
      <SectionHeader label={`Splitting $${total.toFixed(2)} equally — ${included.size} of ${memberIds.length}`} />
      <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, overflow: 'hidden' }}>
        {memberIds.map((id, i) => {
          const p = profileById[id]
          const on = included.has(id)
          return (
            <div
              key={id}
              onClick={() => { if (interactive) onToggle(id) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}`,
                opacity: on ? 1 : 0.4, cursor: interactive ? 'pointer' : 'default',
              }}
            >
              <Avatar profile={p} slot={(i % 4) as 0|1|2|3} size={32} isYou={p?.id === youId} />
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(p, youId)}</div>
              <div style={{
                fontFamily: FH, fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
                color: on ? T.ink : T.inkFaint,
              }}>{on ? `$${share.toFixed(2)}` : '—'}</div>
              <span style={{
                width: 22, height: 22, borderRadius: 6,
                background: on ? T.ink : 'transparent',
                boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${T.lineStrong}`,
                color: T.bg,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>{on ? '✓' : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModePercent({
  total, memberIds, profileById, percents, focusId, youId,
  onChange, onFocus, onBlur,
}: {
  total: number
  memberIds: string[]
  profileById: Record<string, Profile>
  percents: Record<string, string>
  focusId: string | null
  youId?: string
  onChange: (id: string, val: string) => void
  onFocus: (id: string) => void
  onBlur: () => void
}) {
  const sum = memberIds.reduce((a, id) => a + (parseFloat(percents[id] || '0') || 0), 0)
  const remaining = Math.round((100 - sum) * 100) / 100
  const valid = Math.abs(remaining) < 0.005

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader label="Split by percentage" />
      <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, overflow: 'hidden' }}>
        {memberIds.map((id, i) => {
          const p = profileById[id]
          const pct = parseFloat(percents[id] || '0') || 0
          const dollars = total ? (total * pct / 100) : 0
          const isFocus = focusId === id
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px',
              borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}`,
              background: isFocus ? T.surfaceAlt : 'transparent',
            }}>
              <Avatar profile={p} slot={(i % 4) as 0|1|2|3} size={30} isYou={p?.id === youId} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(p, youId)}</div>
                <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 1 }}>${dollars.toFixed(2)}</div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 1,
                padding: '8px 12px', borderRadius: 10, background: T.bg,
                boxShadow: isFocus ? `inset 0 0 0 1.5px ${T.sun}` : `inset 0 0 0 1px ${T.line}`,
                minWidth: 88, justifyContent: 'flex-end',
              }}>
                <input
                  type="number" inputMode="decimal"
                  value={percents[id] ?? ''}
                  onChange={e => onChange(id, e.target.value)}
                  onFocus={() => onFocus(id)}
                  onBlur={onBlur}
                  placeholder="0"
                  style={{
                    width: 48, border: 'none', outline: 'none', background: 'transparent',
                    fontFamily: FH, fontSize: 19, fontWeight: 600, letterSpacing: -0.4,
                    color: T.ink, textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 14, color: T.inkMuted, marginLeft: 2 }}>%</span>
              </div>
            </div>
          )
        })}
      </div>
      <RemainderCounter
        valid={valid}
        label={valid ? 'Adds up to 100%' : remaining > 0 ? 'Remaining' : 'Over by'}
        value={valid ? '0%' : `${remaining > 0 ? '' : '−'}${Math.abs(remaining).toFixed(0)}%`}
      />
    </div>
  )
}

function ModeExact({
  total, memberIds, profileById, amounts, focusId, youId,
  onChange, onFocus, onBlur,
}: {
  total: number
  memberIds: string[]
  profileById: Record<string, Profile>
  amounts: Record<string, string>
  focusId: string | null
  youId?: string
  onChange: (id: string, val: string) => void
  onFocus: (id: string) => void
  onBlur: () => void
}) {
  const sum = memberIds.reduce((a, id) => a + (parseFloat(amounts[id] || '0') || 0), 0)
  const remaining = Math.round((total - sum) * 100) / 100
  const valid = Math.abs(remaining) < 0.005

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader label="Split by exact amount" />
      <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, overflow: 'hidden' }}>
        {memberIds.map((id, i) => {
          const p = profileById[id]
          const amt = parseFloat(amounts[id] || '0') || 0
          const pct = total ? Math.round((amt / total) * 100) : 0
          const isFocus = focusId === id
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px',
              borderTop: i === 0 ? 'none' : `0.5px solid ${T.line}`,
              background: isFocus ? T.surfaceAlt : 'transparent',
            }}>
              <Avatar profile={p} slot={(i % 4) as 0|1|2|3} size={30} isYou={p?.id === youId} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(p, youId)}</div>
                <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{pct}% of total</div>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 2,
                padding: '8px 12px', borderRadius: 10, background: T.bg,
                boxShadow: isFocus ? `inset 0 0 0 1.5px ${T.sun}` : `inset 0 0 0 1px ${T.line}`,
                minWidth: 108, justifyContent: 'flex-end',
              }}>
                <span style={{ fontSize: 14, color: T.inkMuted }}>$</span>
                <input
                  type="number" inputMode="decimal"
                  value={amounts[id] ?? ''}
                  onChange={e => onChange(id, e.target.value)}
                  onFocus={() => onFocus(id)}
                  onBlur={onBlur}
                  placeholder="0.00"
                  style={{
                    width: 64, border: 'none', outline: 'none', background: 'transparent',
                    fontFamily: FH, fontSize: 19, fontWeight: 600, letterSpacing: -0.4,
                    color: T.ink, textAlign: 'right',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <RemainderCounter
        valid={valid}
        label={valid ? 'Balanced — ready to save' : remaining > 0 ? 'Remaining' : 'Over by'}
        value={valid ? '$0.00' : `${remaining > 0 ? '' : '−'}$${Math.abs(remaining).toFixed(2)}`}
      />
    </div>
  )
}

function ModeItemizedPlaceholder() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36 }}>🧾</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FH, color: T.ink }}>Itemized splits</div>
      <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.5, maxWidth: 260 }}>
        Assign individual items to people. Scan a receipt or enter items manually. Coming soon.
      </div>
    </div>
  )
}

function AmountTile({ amount, onChange }: { amount: string; onChange: (v: string) => void }) {
  return (
    <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '14px 16px' }}>
      <div style={TILE_LABEL}>Amount</div>
      <div style={{
        marginTop: 4, fontFamily: FH, fontSize: 38, fontWeight: 600,
        letterSpacing: -1.4, lineHeight: 1,
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        <span style={{ fontSize: 20, color: T.inkMuted, fontWeight: 500 }}>$</span>
        <input
          type="number" inputMode="decimal"
          value={amount}
          onChange={e => onChange(e.target.value)}
          placeholder="0.00"
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: FH, fontSize: 38, fontWeight: 600, letterSpacing: -1.4, color: T.ink,
          }}
        />
      </div>
    </div>
  )
}

function PaidByChips({
  members, profileById, paidById, onSelect, youId, compact,
}: {
  members: { user_id: string }[]
  profileById: Record<string, Profile>
  paidById: string | null
  onSelect: (id: string) => void
  youId?: string
  compact?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap', justifyContent: compact ? 'flex-end' : 'flex-start' }}>
      {members.map((m, i) => {
        const p = profileById[m.user_id]
        const on = paidById === m.user_id
        return (
          <button
            key={m.user_id}
            type="button"
            onClick={() => onSelect(m.user_id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: compact ? (on ? '3px 9px 3px 3px' : 3) : '4px 11px 4px 4px',
              borderRadius: 999,
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.ink,
              boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: F,
            }}
          >
            <Avatar profile={p} slot={(i % 4) as 0|1|2|3} size={22} isYou={p?.id === youId} />
            {(!compact || on) && <span>{shortName(p, youId)}</span>}
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
            key={cat.emoji}
            type="button"
            onClick={() => onSelect(cat.emoji)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px 4px 8px', borderRadius: 999,
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.ink,
              boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
              border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, fontFamily: F,
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

function SplitBetweenChips({
  members, profileById, included, onToggle, youId,
}: {
  members: { user_id: string }[]
  profileById: Record<string, Profile>
  included: Set<string>
  onToggle: (id: string) => void
  youId?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {members.map((m, i) => {
        const p = profileById[m.user_id]
        const on = included.has(m.user_id)
        return (
          <button
            key={m.user_id}
            type="button"
            onClick={() => onToggle(m.user_id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 11px 4px 4px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.inkMuted,
              boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
              fontSize: 12.5, fontWeight: 600, fontFamily: F,
            }}
          >
            <Avatar profile={p} slot={(i % 4) as 0|1|2|3} size={22} isYou={p?.id === youId} />
            {shortName(p, youId)}
            <span style={{ fontSize: 12, lineHeight: 1, opacity: 0.9 }}>{on ? '✓' : '+'}</span>
          </button>
        )
      })}
    </div>
  )
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px' }}>
      <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Date</div>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: T.r.md,
          border: `1px solid ${T.line}`, background: T.bg,
          fontSize: 14, fontFamily: F, color: T.ink, outline: 'none',
        }}
      />
    </div>
  )
}

function FooterStatusHint({
  splitMode, amt, included, percentValid, exactValid,
}: {
  splitMode: SplitMode
  amt: number
  included: Set<string>
  percentValid: boolean
  exactValid: boolean
}) {
  const share = included.size > 0 ? Math.round((amt / included.size) * 100) / 100 : 0

  if (splitMode === 'equal' && included.size > 0 && amt > 0) {
    return (
      <span>
        Each pays{' '}
        <b style={{ color: T.ink, fontFamily: FMONO }}>${share.toFixed(2)}</b>
        {' · '}{included.size} {included.size === 1 ? 'person' : 'people'}
      </span>
    )
  }
  if (splitMode === 'percentage') {
    return percentValid
      ? <span style={{ color: T.mintInk, fontWeight: 700 }}>✓ Adds up to 100%</span>
      : <span style={{ color: T.coralInk, fontWeight: 700 }}>! Doesn&apos;t sum to 100%</span>
  }
  if (splitMode === 'exact') {
    return exactValid
      ? <span style={{ color: T.mintInk, fontWeight: 700 }}>✓ Balanced</span>
      : <span style={{ color: T.coralInk, fontWeight: 700 }}>! Doesn&apos;t sum to total</span>
  }
  if (splitMode === 'itemized') {
    return <span>Itemized splits coming soon</span>
  }
  return null
}

function SaveFooter({
  onCancel, onSave, canSave, saveLabel, isPending, showStatus, statusHint,
}: {
  onCancel: () => void
  onSave: () => void
  canSave: boolean
  saveLabel: string
  isPending: boolean
  showStatus: boolean
  statusHint: ReactNode
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
          style={{
            padding: '10px 16px', borderRadius: 10,
            background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer',
            fontFamily: F, fontSize: 13, fontWeight: 700,
          }}
        >Cancel</button>
        <button
          type="button" onClick={onSave}
          disabled={!canSave || isPending}
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

  // Shared amount input (native numeric keyboard on mobile).
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

  const memberIds   = members.map(m => m.user_id)
  const profileById = Object.fromEntries(members.map(m => [m.user_id, (m as { profile: Profile }).profile]))
  const youId       = profile?.id

  useEffect(() => {
    if (profile && !paidById) setPaidById(profile.id)
  }, [profile?.id])

  useEffect(() => {
    if (members.length > 0 && included.size === 0) setIncluded(new Set(memberIds))
  }, [members.length])

  useEffect(() => {
    if (!manualCategory && description) setCategory(detectCategory(description))
    // if (!description) { setManualCategory(false); setCategory('💸') }
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

  const amt          = parseFloat(amount) || 0
  const percentSum   = memberIds.reduce((a, id) => a + (parseFloat(percents[id] || '0') || 0), 0)
  const exactSum     = memberIds.reduce((a, id) => a + (parseFloat(exactAmounts[id] || '0') || 0), 0)
  const percentValid = Math.abs(percentSum - 100) < 0.005
  const exactValid   = amt > 0 && Math.abs(exactSum - amt) < 0.005

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

  const statusHint = (
    <FooterStatusHint
      splitMode={splitMode} amt={amt} included={included}
      percentValid={percentValid} exactValid={exactValid}
    />
  )

  async function handleSave() {
    if (!canSave || addExpense.isPending || !paidById) return
    const roundedAmt = Math.round(amt * 100) / 100

    let splits: { user_id: string; owed_amount: number }[]
    let splitType: 'equal' | 'percentage' | 'exact'

    if (splitMode === 'equal') {
      splits    = makeEqualSplits('', roundedAmt, [...included]).map(s => ({ user_id: s.user_id, owed_amount: s.owed_amount }))
      splitType = 'equal'
    } else if (splitMode === 'percentage') {
      splits    = makePercentSplits('', roundedAmt, memberIds.map(id => ({ user_id: id, percent: parseFloat(percents[id] || '0') || 0 }))).map(s => ({ user_id: s.user_id, owed_amount: s.owed_amount }))
      splitType = 'percentage'
    } else {
      splits    = makeExactSplits('', memberIds.map(id => ({ user_id: id, owed_amount: parseFloat(exactAmounts[id] || '0') || 0 }))).map(s => ({ user_id: s.user_id, owed_amount: s.owed_amount }))
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

  function SplitZone() {
    const equalMemberIds = isMobile ? [...included] : memberIds
    return (
      <>
        {splitMode === 'equal' && (
          <ModeEqual
            total={amt}
            memberIds={equalMemberIds}
            profileById={profileById}
            included={included}
            onToggle={toggleIncluded}
            youId={youId}
            interactive={!isMobile}
          />
        )}
        {splitMode === 'percentage' && (
          <ModePercent
            total={amt} memberIds={memberIds} profileById={profileById}
            percents={percents} focusId={focusId} youId={youId}
            onChange={(id, val) => setPercents(p => ({ ...p, [id]: val }))}
            onFocus={setFocusId} onBlur={() => setFocusId(null)}
          />
        )}
        {splitMode === 'exact' && (
          <ModeExact
            total={amt} memberIds={memberIds} profileById={profileById}
            amounts={exactAmounts} focusId={focusId} youId={youId}
            onChange={(id, val) => setExactAmounts(p => ({ ...p, [id]: val }))}
            onFocus={setFocusId} onBlur={() => setFocusId(null)}
          />
        )}
        {splitMode === 'itemized' && <ModeItemizedPlaceholder />}
      </>
    )
  }

  const groupLabel = group ? `${group.emoji} ${group.name}` : '…'

  // ── Mobile: bottom sheet layout with native numeric keyboard ──────────────
  if (isMobile) {
    return (
      <div className="add-expense-panel add-expense-panel--mobile">
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 14px 8px', flexShrink: 0,
        }}>
          <button
            type="button" onClick={onCancel}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              fontFamily: F, fontSize: 14, fontWeight: 700,
              color: T.inkMuted, padding: '6px 4px',
            }}
          >Cancel</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkFaint }}>
              New expense
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1, fontFamily: F }}>{groupLabel}</div>
          </div>
          <button
            type="button" onClick={handleSave}
            disabled={!canSave || addExpense.isPending}
            style={{
              border: 0, cursor: canSave ? 'pointer' : 'default', fontFamily: F,
              padding: '8px 16px', borderRadius: 999,
              background: canSave ? T.sun : T.lineStrong,
              color: canSave ? T.sunInk : T.inkFaint,
              fontSize: 14, fontWeight: 700,
            }}
          >Save</button>
        </div>

        {/* amount input */}
        <div style={{ padding: '2px 0 10px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            fontFamily: FH, fontWeight: 600, letterSpacing: -2,
            fontSize: 52, lineHeight: 1,
            color: amt > 0 ? T.ink : T.inkFaint,
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2,
          }}
          className="border-2"
          >
            <span style={{ fontSize: 26, color: T.inkMuted, marginRight: 4, fontWeight: 500 }}>$</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="add-expense-amount-input"
              style={{
                width: 180,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: FH,
                fontSize: 52,
                fontWeight: 600,
                letterSpacing: -2,
                color: T.ink,
                textAlign: 'left',
              }}
            />
          </div>
        </div>

        {/* scrollable tiles */}
        <div className="add-expense-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* description */}
          <div style={TILE}>
            <div style={TILE_LABEL}>Description</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, background: T.sunSoft, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>{category}</span>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What was it for?"
                style={{
                  flex: 1, border: 0, outline: 'none', background: 'transparent',
                  fontFamily: F, fontSize: 15, fontWeight: 600, color: T.ink,
                }}
              />
            </div>
          </div>

          {/* paid by */}
          <div style={TILE}>
            <div style={TILE_LABEL}>Paid by</div>
            <div style={{ marginTop: 9 }}>
              <PaidByChips
                members={members} profileById={profileById}
                paidById={paidById} onSelect={setPaidById} youId={youId}
              />
            </div>
          </div>

          {/* category */}
          <div style={TILE}>
            <div style={TILE_LABEL}>Category</div>
            <div style={{ marginTop: 9 }}>
              <CategoryChips category={category} onSelect={selectCategory} />
            </div>
          </div>

          {/* split between */}
          <div style={TILE}>
            <div style={{ ...TILE_LABEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Split between</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.inkFaint }}>
                {included.size} of {memberIds.length}
              </span>
            </div>
            <div style={{ marginTop: 9 }}>
              <SplitBetweenChips
                members={members}
                profileById={profileById}
                included={included}
                onToggle={toggleIncluded}
                youId={youId}
              />
            </div>
          </div>

          {/* split */}
          <div>
            <div style={{ ...TILE_LABEL, marginBottom: 8, paddingLeft: 2 }}>Split</div>
            <ModeTabs value={splitMode} onChange={setSplitMode} />
            <div style={{ marginTop: 12 }}>
              <SplitZone />
            </div>
          </div>
        </div>

        <div style={{
          flexShrink: 0, padding: '11px 18px 14px',
          borderTop: `0.5px solid ${T.line}`, background: T.surfaceAlt,
          fontSize: 12.5, color: T.inkMuted, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {statusHint}
        </div>
      </div>
    )
  }

  // ── Desktop: two-column modal layout ─────────────────────────────────────
  return (
    <div className="add-expense-panel add-expense-panel--desktop">
      <header className="add-expense-desktop-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkMuted }}>
            New expense · {groupLabel}
          </div>
          <div style={{
            marginTop: 3, fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.6, color: T.ink,
              }}
            />
          </div>
        </div>
        <button
          type="button" onClick={onCancel} aria-label="Close"
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'transparent', border: 0, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: T.inkMuted, flexShrink: 0,
          }}
        >✕</button>
      </header>

      <div className="add-expense-desktop-body">
        <div className="add-expense-desktop-left">
          <AmountTile amount={amount} onChange={setAmount} />

          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px' }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Paid by</div>
            <PaidByChips
              members={members} profileById={profileById}
              paidById={paidById} onSelect={setPaidById} youId={youId}
            />
          </div>

          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px' }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Category</div>
            <CategoryChips category={category} onSelect={selectCategory} />
          </div>

          <DateField value={expenseDate} onChange={setExpenseDate} />
        </div>

        <div className="add-expense-desktop-right">
          <div style={{ paddingBottom: 12, flexShrink: 0 }}>
            <ModeTabs value={splitMode} onChange={setSplitMode} />
          </div>
          <div className="add-expense-scroll">
            <SplitZone />
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
