'use client'

import { T, FH, F, FMONO, well } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Input } from '@/components/Input'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import type { LineItem } from './types'
import type { AddExpenseFormState } from './useAddExpenseForm'

// Mobile itemized receipt builder. UI-only preview — nothing reaches handleSave
// until expense_items gets a save path. Lives in its own file because the
// itemize redesign replaces this component wholesale rather than editing it.
export function ItemizedBuilder({ s }: { s: AddExpenseFormState }) {
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
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: F, fontSize: 16, fontWeight: 600, color: T.ink, caretColor: T.sun, minWidth: 0 }}
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
