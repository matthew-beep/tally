'use client'

import type { ReactNode } from 'react'
import { T, FH, F, FMONO, well } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { SectionLabel } from '@/components/SectionLabel'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, round2, stripNegative, parseNum } from '@/lib/money'
import type { GroupMember } from '@/types'
import { ALGORITHMS, algoLabel, type SplitMode, type LineItem } from './types'
import { RemainderCounter, Hairline, Chevron, Checkbox, shortName, fmtPct } from './parts'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { PersonToken } from '@/components/PersonToken'
import type { AddExpenseFormState } from './useAddExpenseForm'

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

function PayerPillRow({ members, slotById, paidById, onSelect, youMemberId }: {
  members: GroupMember[]; slotById: Record<string, 0|1|2|3>
  paidById: string | null; onSelect: (id: string) => void; youMemberId?: string
}) {
  return (
    <div style={{ paddingBottom: 14 }}>
      {/* Raised tokens need vertical room for their shadow, hence the padding. */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px 8px' }}>
        {members.map(m => (
          <PersonToken
            key={m.id}
            member={m}
            slot={slotById[m.id] ?? 0}
            selected={paidById === m.id}
            onClick={() => onSelect(m.id)}
            youMemberId={youMemberId}
          />
        ))}
      </div>
    </div>
  )
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
              {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.sunOn }} />}
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

// Avatar + name for one Expense Details row. Payer rows are non-interactive.
function PersonLabel({ m, id, slotById, isPayer, youMemberId, onClick }: {
  m: GroupMember | undefined; id: string; slotById: Record<string, 0|1|2|3>
  isPayer: boolean; youMemberId?: string; onClick: () => void
}) {
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
// Balance semantics: equal divides the total across everyone included; exact/%
// only require the OTHER members to balance — the payer's share is whatever is
// left over, computed in handleSave. The remainder pill reads straight off the
// hook's shared validity state so it can't disagree with the Save button.
function ExpenseBreakdown({ s, payerId }: { s: AddExpenseFormState; payerId: string }) {
  const {
    splitMode, memberIds, memberById, slotById, amt: total, included, toggleIncluded,
    youMemberId, exactAmounts, setExactAmount, percents, setPercent,
    percentValid, exactValid, percentRemaining, exactRemaining,
  } = s

  const activeCount = memberIds.filter(id => included.has(id)).length
  const per = activeCount > 0 ? round2(total / activeCount) : 0

  let remainder: { valid: boolean; label: string; value: string } | null = null
  if (splitMode === 'exact') {
    remainder = {
      valid: exactValid,
      label: exactValid ? 'Balanced — ready to save' : exactRemaining > 0 ? 'Remaining' : 'Over by',
      value: exactValid ? '$0.00' : `${exactRemaining > 0 ? '' : '−'}${formatAmount(exactRemaining)}`,
    }
  } else if (splitMode === 'percentage') {
    remainder = {
      valid: percentValid,
      label: percentValid ? 'Adds up to 100%' : percentRemaining < 0 ? 'Over by' : 'Remaining',
      value: percentValid ? '0%' : `${percentRemaining < 0 ? '−' : ''}${fmtPct(Math.abs(percentRemaining))}%`,
    }
  }

  return (
    <>
      {memberIds.map((id, idx) => {
        const m = memberById[id]
        const isPayer = id === payerId
        const on = included.has(id)
        const isLast = idx === memberIds.length - 1
        const pct = parseNum(percents[id])
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
              : <Checkbox on={on} onClick={() => toggleIncluded(id)} />
            }
            <PersonLabel m={m} id={id} slotById={slotById} isPayer={isPayer} youMemberId={youMemberId} onClick={() => toggleIncluded(id)} />

            {splitMode === 'equal' ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: on ? T.ink : T.inkFaint }}>{formatAmount(rowAmt)}</div>
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>{isPayer ? 'paid' : on ? 'owes' : '—'}</div>
              </div>
            ) : isPayer ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: T.ink }}>{formatAmount(total)}</div>
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>paid</div>
              </div>
            ) : splitMode === 'exact' ? (
              <Input
                size="cell" prefix="$" alignRight fieldWidth={52} disabled={!on}
                type="number" inputMode="decimal" min={0}
                value={on ? (exactAmounts[id] ?? '') : ''}
                onChange={e => setExactAmount(id, stripNegative(e.target.value))}
                placeholder="0.00"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <Input
                  size="cell" suffix="%" alignRight fieldWidth={34} disabled={!on}
                  type="number" inputMode="decimal" min={0}
                  value={on ? (percents[id] ?? '') : ''}
                  onChange={e => setPercent(id, stripNegative(e.target.value))}
                  placeholder="0"
                />
                <span style={{ fontFamily: FMONO, fontSize: 10, color: T.inkFaint }}>{formatAmount(on ? total * pct / 100 : 0)}</span>
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
function BreakdownItems({ s }: { s: AddExpenseFormState }) {
  const {
    memberIds, memberById, slotById, items, addItem, removeItem, renameItem, priceItem, toggleAssign,
    taxMode, setTaxMode, taxVal, setTaxVal, taxAmt,
    tipMode, setTipMode, tipVal, setTipVal, tipAmt,
    subtotal, itemTotal, youMemberId,
  } = s

  const rows = [
    { label: 'Tax', mode: taxMode, setMode: setTaxMode, val: taxVal, setVal: setTaxVal, amt: taxAmt },
    { label: 'Tip', mode: tipMode, setMode: setTipMode, val: tipVal, setVal: setTipVal, amt: tipAmt },
  ]

  return (
    <>
      {items.map((it: LineItem) => (
        <div key={it.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: `0.5px solid ${T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={it.name} onChange={e => renameItem(it.id, e.target.value)} placeholder="Item name"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink, caretColor: T.sun, minWidth: 0 }}
            />
            <Input
              size="cell" prefix="$" alignRight fieldWidth={44}
              type="number" inputMode="decimal" min={0} value={it.price || ''}
              onChange={e => priceItem(it.id, Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0.00"
              style={{ flexShrink: 0 }}
            />
            <button type="button" onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.3, flexShrink: 0 }}>
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
                  key={id} type="button" onClick={() => toggleAssign(it.id, id)}
                  style={{ padding: 0, background: 'none', border: `2px solid ${on ? T.sun : 'transparent'}`, borderRadius: '50%', cursor: 'pointer', opacity: on ? 1 : 0.25, transition: 'all 0.13s', flexShrink: 0 }}
                >
                  <Avatar profile={memberById[id] ? avatarProfile(memberById[id]) : undefined} slot={slotById[id] ?? 0} size={28} isYou={id === youMemberId} />
                </button>
              )
            })}
            {it.assignedTo.length > 1 && (
              <span style={{ fontSize: 10, color: T.inkFaint, fontFamily: FMONO, marginLeft: 2, whiteSpace: 'nowrap' }}>
                ÷{it.assignedTo.length} = {formatAmount(it.price / it.assignedTo.length)}/ea
              </span>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '4px 0 12px', cursor: 'pointer', fontFamily: F, color: T.sun }}>
        <svg width={12} height={12} viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke={T.sun} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Add item</span>
      </button>

      <div style={{ borderTop: `0.5px solid ${T.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `0.5px solid ${T.line}` }}>
          <span style={{ fontSize: 13, color: T.inkMuted, fontWeight: 500 }}>Subtotal</span>
          <span style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 600 }}>{formatAmount(subtotal)}</span>
        </div>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: `0.5px solid ${T.line}` }}>
            <span style={{ fontSize: 13, color: T.inkMuted, fontWeight: 500, flex: 1 }}>{row.label}</span>
            <div style={{ display: 'flex', borderRadius: 999, padding: 2, gap: 1, ...well() }}>
              {(['percent', 'flat'] as const).map(opt => {
                const sel = row.mode === opt
                return (
                  <button
                    key={opt} type="button" onClick={() => row.setMode(opt)}
                    style={{ padding: '2px 8px', borderRadius: 999, border: 'none', background: sel ? T.surface : 'none', fontSize: 11, fontWeight: sel ? 700 : 500, color: sel ? T.ink : T.inkMuted, cursor: 'pointer', fontFamily: F, boxShadow: sel ? T.shadowRaised : T.shadowNone }}
                  >{opt === 'percent' ? '%' : '$'}</button>
                )
              })}
            </div>
            <Input
              size="cell" alignRight fieldWidth={36}
              prefix={row.mode === 'flat' ? '$' : undefined}
              suffix={row.mode === 'percent' ? '%' : undefined}
              type="number" inputMode="decimal" min={0} value={row.val}
              onChange={e => row.setVal(Math.max(0, parseFloat(e.target.value) || 0))}
            />
            <span style={{ fontFamily: FMONO, fontSize: 12, color: T.inkMuted, minWidth: 44, textAlign: 'right' }}>{formatAmount(row.amt)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total</span>
          <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: T.ink }}>{formatAmount(itemTotal)}</span>
        </div>
      </div>
    </>
  )
}

// ── Mobile layout: title + amount, two collapsible rows, expense details ─────
export function MobilePanel({ s, onCancel }: { s: AddExpenseFormState; onCancel: () => void }) {
  const payer = s.paidById ? s.memberById[s.paidById] : undefined
  const isItemized = s.splitMode === 'itemized'
  const saveLabel = s.isPending ? 'Saving…' : isItemized ? 'Itemized — coming soon' : 'Save expense'

  return (
    <div className="add-expense-panel add-expense-panel--mobile">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 8px', flexShrink: 0 }}>
        <button
          type="button" onClick={onCancel}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: F, fontSize: 15, fontWeight: 600, color: T.inkMuted, padding: '6px 4px' }}
        >Cancel</button>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkMuted, background: T.surfaceAlt, padding: '4px 12px', borderRadius: 999 }}>
          {s.groupLabel}
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div className="add-expense-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <Input
          size="title" fullWidth autoFocus
          type="text" value={s.description} onChange={e => s.setDescription(e.target.value)}
          placeholder="What was it for?"
          style={{ marginBottom: 10 }}
        />

        <div style={{ paddingBottom: 18 }}>
          {isItemized ? (
            // Itemized totals are derived, not typed — a flat readout, not a well.
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontFamily: FH, fontSize: 24, fontWeight: 500, color: T.inkMuted }}>$</span>
              <span style={{ fontFamily: FH, fontSize: 38, fontWeight: 800, letterSpacing: -1.5, color: s.itemTotal > 0 ? T.ink : T.inkFaint }}>
                {s.itemTotal > 0 ? s.itemTotal.toFixed(2) : '0.00'}
              </span>
              <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 6, alignSelf: 'flex-end', paddingBottom: 5 }}>from receipt</span>
            </div>
          ) : (
            <Input
              size="hero" fullWidth prefix="$"
              type="number" inputMode="decimal" min={0}
              value={s.amount} onChange={e => s.setAmount(stripNegative(e.target.value))}
              placeholder="0.00"
              inputClassName="add-expense-amount-input"
            />
          )}
        </div>

        <Hairline />

        <CollapsibleRow
          label="Paid by" open={s.openPanel === 'payer'}
          onClick={() => s.setOpenPanel(s.openPanel === 'payer' ? null : 'payer')}
          value={
            <>
              <Avatar profile={payer ? avatarProfile(payer) : undefined} slot={s.paidById ? (s.slotById[s.paidById] ?? 0) : 0} size={22} isYou={s.paidById === s.youMemberId} />
              <span style={{ fontSize: 15, fontWeight: 500, color: s.openPanel === 'payer' ? T.sun : T.inkMuted }}>
                {shortName(payer, s.youMemberId)}
              </span>
            </>
          }
        />
        {s.openPanel === 'payer' && (
          <PayerPillRow
            members={s.members} slotById={s.slotById}
            paidById={s.paidById} onSelect={s.setPaidById} youMemberId={s.youMemberId}
          />
        )}

        <Hairline />

        <CollapsibleRow
          label="Split" open={s.openPanel === 'split'}
          onClick={() => s.setOpenPanel(s.openPanel === 'split' ? null : 'split')}
          value={
            <span style={{ fontSize: 15, fontWeight: 500, color: s.openPanel === 'split' ? T.sun : T.inkMuted }}>
              {algoLabel(s.splitMode)}
            </span>
          }
        />
        {s.openPanel === 'split' && (
          <div style={{ paddingBottom: 10 }}>
            <AlgorithmRadios splitMode={s.splitMode} onSelect={m => { s.setSplitMode(m); s.setOpenPanel(null) }} />
          </div>
        )}

        <Hairline />

        {(isItemized || s.amt > 0) && s.paidById && (
          <>
            <div style={{ padding: '14px 0' }}>
              <SectionLabel size="sm" color={T.inkFaint} style={{ marginBottom: 10 }}>Expense Details</SectionLabel>
              {isItemized
                ? <BreakdownItems s={s} />
                : <ExpenseBreakdown s={s} payerId={s.paidById} />}
            </div>
            <Hairline />
          </>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '12px 18px 28px', background: T.surface }}>
        <Btn
          onClick={s.handleSave} disabled={!s.canSave || s.isPending} variant="primary" size="lg" fullWidth
          style={{
            borderRadius: 14,
            padding: '17px', fontSize: 16,
            fontFamily: FH, letterSpacing: -0.2,
          }}
        >{saveLabel}</Btn>
      </div>
    </div>
  )
}
