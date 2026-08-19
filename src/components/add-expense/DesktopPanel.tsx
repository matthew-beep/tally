'use client'

import type { ReactNode } from 'react'
import { T, FH, F, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { SectionLabel } from '@/components/SectionLabel'
import { CATEGORIES } from '@/lib/categories'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, round2, stripNegative, parseNum } from '@/lib/money'
import { ModalHeader } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { Segmented } from '@/components/Segmented'
import { PersonToken, Token } from '@/components/PersonToken'
import { DatePicker } from '@/components/DatePicker'
import type { GroupMember } from '@/types'
import type { SplitMode } from './types'
import { RemainderInline, shortName } from './parts'
import type { AddExpenseFormState } from './useAddExpenseForm'

// Desktop 4-way split_type tab strip. Mobile uses AlgorithmRadios instead.
const MODE_TABS: { value: SplitMode; label: string }[] = [
  { value: 'equal',      label: 'Equal'    },
  { value: 'percentage', label: 'Percent'  },
  { value: 'exact',      label: 'Exact'    },
  { value: 'itemized',   label: 'Itemized' },
]

function ModeTabs({ value, onChange }: { value: SplitMode; onChange: (m: SplitMode) => void }) {
  return <Segmented options={MODE_TABS} value={value} onChange={onChange} />
}

// Unified desktop split list — one row renderer for all three amount modes.
// Itemized shows a coming-soon placeholder.
function DesktopSplitList({ s }: { s: AddExpenseFormState }) {
  const {
    splitMode: mode, amt: total, memberIds, memberById, included, toggleIncluded, youMemberId,
    percents, setPercent, exactAmounts, setExactAmount, focusId, setFocusId,
    percentValid, exactValid, percentRemaining, exactRemaining,
  } = s

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

  const share = included.size > 0 ? round2(total / included.size) : 0

  const header =
    mode === 'equal'      ? `Splitting ${formatAmount(total)} equally — ${included.size} of ${memberIds.length}` :
    mode === 'percentage' ? 'Split by percentage' :
                            'Split by exact amount'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px 8px' }}>
        <SectionLabel size="sm" style={{ padding: 0 }}>{header}</SectionLabel>
        {mode === 'percentage' && (
          <RemainderInline
            valid={percentValid}
            label={percentValid ? 'Adds up to 100%' : percentRemaining > 0 ? 'Remaining' : 'Over by'}
            value={percentValid ? '0%' : `${percentRemaining > 0 ? '' : '−'}${Math.abs(percentRemaining).toFixed(0)}%`}
          />
        )}
        {mode === 'exact' && (
          <RemainderInline
            valid={exactValid}
            label={exactValid ? 'Balanced' : exactRemaining > 0 ? 'Remaining' : 'Over by'}
            value={exactValid ? '$0.00' : `${exactRemaining > 0 ? '' : '−'}${formatAmount(exactRemaining)}`}
          />
        )}
      </div>
      <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, overflow: 'hidden' }}>
        {memberIds.map((id, i) => {
          const m = memberById[id]
          const on = included.has(id)
          const isFocus = focusId === id
          const pct = parseNum(percents[id])
          const exactAmt = parseNum(exactAmounts[id])
          const pctOfTotal = total ? Math.round((exactAmt / total) * 100) : 0
          const dollars = total ? (total * pct / 100) : 0

          return (
            <div
              key={id}
              onClick={() => { if (mode === 'equal') toggleIncluded(id) }}
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
                    {on ? formatAmount(share) : '—'}
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
                    <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{formatAmount(dollars)}</div>
                  </div>
                  <Input
                    size="cellLg" suffix="%" alignRight fieldWidth={48}
                    type="number" inputMode="decimal" min={0}
                    value={percents[id] ?? ''}
                    onChange={e => setPercent(id, stripNegative(e.target.value))}
                    onFocus={() => setFocusId(id)} onBlur={() => setFocusId(null)}
                    placeholder="0"
                    style={{ minWidth: 88, justifyContent: 'flex-end' }}
                  />
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{shortName(m, youMemberId)}</div>
                    <div style={{ fontFamily: FMONO, fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{pctOfTotal}% of total</div>
                  </div>
                  <Input
                    size="cellLg" prefix="$" alignRight fieldWidth={64}
                    type="number" inputMode="decimal" min={0}
                    value={exactAmounts[id] ?? ''}
                    onChange={e => setExactAmount(id, stripNegative(e.target.value))}
                    onFocus={() => setFocusId(id)} onBlur={() => setFocusId(null)}
                    placeholder="0.00"
                    style={{ minWidth: 108, justifyContent: 'flex-end' }}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaidByChips({ members, paidById, onSelect, youMemberId }: {
  members: GroupMember[]
  paidById: string | null
  onSelect: (id: string) => void
  youMemberId?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '2px 0 6px' }}>
      {members.map((m, i) => (
        <PersonToken
          key={m.id}
          member={m}
          slot={(i % 4) as 0 | 1 | 2 | 3}
          selected={paidById === m.id}
          onClick={() => onSelect(m.id)}
          youMemberId={youMemberId}
          size="sm"
        />
      ))}
    </div>
  )
}

function CategoryChips({ category, onSelect }: { category: string; onSelect: (emoji: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {CATEGORIES.map(cat => (
        <Token
          key={cat.emoji}
          size="sm"
          selected={category === cat.emoji}
          onClick={() => onSelect(cat.emoji)}
          leading={<span style={{ fontSize: 13, marginLeft: 4 }}>{cat.emoji}</span>}
        >
          {cat.label}
        </Token>
      ))}
    </div>
  )
}

// Footer status — tells the user what's blocking Save. Mobile shows RemainderCounter inline instead.
function FooterStatusHint({ s }: { s: AddExpenseFormState }) {
  const { splitMode, amt, included, percentValid, exactValid } = s
  const share = included.size > 0 ? round2(amt / included.size) : 0

  if (splitMode === 'equal' && included.size > 0 && amt > 0) {
    return (
      <span>
        Each pays <b style={{ color: T.ink, fontFamily: FMONO }}>{formatAmount(share)}</b>
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

function SaveFooter({ onCancel, onSave, canSave, saveLabel, isPending, statusHint }: {
  onCancel: () => void; onSave: () => void; canSave: boolean; saveLabel: string
  isPending: boolean; statusHint: ReactNode
}) {
  return (
    <footer className="add-expense-desktop-footer">
      <div style={{ fontSize: 12, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 10 }}>
        {statusHint}
      </div>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button
          type="button" onClick={onCancel}
          style={{ padding: '10px 16px', borderRadius: 10, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', fontFamily: F, fontSize: 13, fontWeight: 700 }}
        >Cancel</button>
        <Btn
          onClick={onSave} disabled={!canSave || isPending} variant="primary" size="md"
          style={{
            padding: '10px 20px', borderRadius: 10,
            fontSize: 14, letterSpacing: -0.2,
          }}
        >{saveLabel}</Btn>
      </div>
    </footer>
  )
}

// ── Desktop layout: two-column modal — tiles left, split list right ──────────
export function DesktopPanel({ s, onCancel }: { s: AddExpenseFormState; onCancel: () => void }) {
  return (
    <div className="add-expense-panel add-expense-panel--desktop">
      <ModalHeader onClose={onCancel}>
        <SectionLabel size="sm">New expense · {s.groupLabel}</SectionLabel>
        <div style={{ marginTop: 8 }}>
          <Input
            size="title" fullWidth autoFocus
            value={s.description} onChange={e => s.setDescription(e.target.value)}
            placeholder="What was this for?"
          />
        </div>
      </ModalHeader>

      <div className="add-expense-desktop-body">
        <div className="add-expense-desktop-left">
          <div>
            <SectionLabel size="sm">Amount</SectionLabel>
            <Input
              size="hero" fullWidth prefix="$"
              type="text" inputMode="decimal"
              value={s.amount} onChange={e => s.setAmount(stripNegative(e.target.value))}
              placeholder="0.00"
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <SectionLabel size="sm" style={{ marginBottom: 8 }}>Paid by</SectionLabel>
            <PaidByChips members={s.members} paidById={s.paidById} onSelect={s.setPaidById} youMemberId={s.youMemberId} />
          </div>

          <div>
            <SectionLabel size="sm" style={{ marginBottom: 8 }}>Category</SectionLabel>
            <CategoryChips category={s.category} onSelect={s.selectCategory} />
          </div>

          <div className="h-full">
            <SectionLabel size="sm" style={{ marginBottom: 8 }}>Date</SectionLabel>
            <DatePicker value={s.expenseDate} onChange={s.setExpenseDate} />
          </div>
        </div>

        <div className="add-expense-desktop-right">
          <div style={{ paddingBottom: 12, flexShrink: 0 }}>
            <ModeTabs value={s.splitMode} onChange={s.setSplitMode} />
          </div>
          <div className="add-expense-scroll">
            <DesktopSplitList s={s} />
          </div>
        </div>
      </div>

      <SaveFooter
        onCancel={onCancel} onSave={s.handleSave}
        canSave={s.canSave} saveLabel={s.saveLabel} isPending={s.isPending}
        statusHint={<FooterStatusHint s={s} />}
      />
    </div>
  )
}
