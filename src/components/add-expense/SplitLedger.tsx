'use client'

import type { CSSProperties } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { Segmented } from '@/components/Segmented'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, round2, stripNegative, parseNum } from '@/lib/money'
import { SPLIT_TABS } from './types'
import { shortName, fmtPct } from './parts'
import type { AddExpenseFormState } from './useAddExpenseForm'

const head: CSSProperties = {
  fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8,
  textTransform: 'uppercase', color: T.inkFaint,
}

// Columns shared by the heading row and every member row, so they line up.
const IN_COL  = 46
const OWE_COL = 96

/** The "in the split" box — sun-filled when on, a flat hairline square when off. */
function InBox({ on }: { on: boolean }) {
  return (
    <span style={{
      width: 21, height: 21, borderRadius: 7, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: on ? `linear-gradient(180deg, ${T.sunHi}, ${T.sun})` : T.bg,
      boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 2px rgba(31,26,20,0.14)' : T.shadowHair,
      transition: 'background .14s ease',
    }}>
      {on && (
        <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
          <path d="M1 5l3.4 3.4L11 1.4" stroke={T.sunOn} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

/**
 * The split, as one table: who is in, and what each of them owes. Sits behind
 * the sentence's split token — the dialog opens at 560 and slides this out
 * beside the form when you go to change it, because nine expenses in ten are
 * split equally and don't need a four-column table to say so.
 *
 * The left column is participation, not a paid marker: the sentence already
 * names the payer. The payer's row has no box at all — they're always in their
 * own expense (useAddExpenseForm enforces it), so a box there could only ever
 * be a control that does nothing.
 *
 * Every figure in the Owes column comes from `s.previewSplits` where there is
 * one, so the table shows exactly what Save will write, leftover cent included.
 */
export function SplitLedger({ s, placement, onClose }: {
  s: AddExpenseFormState
  placement: 'side' | 'below'
  onClose: () => void
}) {
  const {
    splitMode, amt, memberIds, memberById, slotById, youMemberId, paidById,
    included, toggleIncluded, percents, setPercent, exactAmounts, setExactAmount,
    percentValid, exactValid, percentRemaining, exactRemaining, evenOut, previewSplits,
  } = s

  const inCount = memberIds.filter(id => included.has(id)).length
  const evenShare = inCount > 0 ? round2(amt / inCount) : 0

  const balanced =
    splitMode === 'exact'      ? exactValid :
    splitMode === 'percentage' ? percentValid :
    true

  const status =
    splitMode === 'exact'
      ? exactValid
        ? `${formatAmount(amt)} accounted for`
        : `${formatAmount(Math.abs(exactRemaining))} ${exactRemaining > 0 ? 'left to assign' : 'over'}`
      : splitMode === 'percentage'
        ? percentValid
          ? '100% accounted for'
          : `${fmtPct(Math.abs(percentRemaining))}% ${percentRemaining > 0 ? 'left to assign' : 'over'}`
        : splitMode === 'itemized'
          ? 'The receipt decides the split — pick a method to replace it'
          : `${inCount} of ${memberIds.length} sharing`

  return (
    <section
      aria-label="Split"
      style={{
        padding: '16px 18px 18px', borderRadius: T.r.lg,
        background: T.sink, boxShadow: T.shadowRecessed,
        marginTop: placement === 'below' ? 16 : 0,
        animation: placement === 'side'
          ? 'add-expense-ledger-in .22s cubic-bezier(.32,.72,0,1) both'
          : 'fade-up .2s ease-out both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>
          Who&rsquo;s in, and who owes what
        </span>
        <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: T.inkFaint, fontVariantNumeric: 'tabular-nums' }}>
          {formatAmount(amt)}
        </span>
        <button
          type="button" onClick={onClose} aria-label="Close the split"
          style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9, border: 0, cursor: 'pointer', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke={T.inkFaint} strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
      </div>

      {/* Same replace-the-receipt rule as the mobile split sheet — unreachable
          here while itemizing is a stub, but the two tab strips shouldn't
          disagree about what picking a method does. */}
      <Segmented
        options={SPLIT_TABS} value={splitMode} fullWidth
        style={{ background: T.bg, boxShadow: T.shadowHair }}
        onChange={m => {
          if (splitMode === 'itemized') {
            if (!s.amount && s.itemTotal > 0) s.setAmount(s.itemTotal.toFixed(2))
            s.clearItems()
          }
          s.setSplitMode(m)
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 2px 7px' }}>
        <span style={{ ...head, width: IN_COL, textAlign: 'center', flexShrink: 0 }}>In</span>
        <span style={{ ...head, flex: 1, minWidth: 0 }}>Person</span>
        <span style={{ ...head, minWidth: OWE_COL, textAlign: 'right' }}>Owes</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {memberIds.map((id, i) => {
          const m = memberById[id]
          const on = included.has(id)
          const isPayer = id === paidById
          const owed = previewSplits?.[id] ?? evenShare
          const pctDollars = round2(amt * parseNum(percents[id]) / 100)

          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px',
              borderBottom: i < memberIds.length - 1 ? `0.5px solid ${T.line}` : 'none',
            }}>
              {isPayer ? (
                <span style={{ width: IN_COL, flexShrink: 0 }} />
              ) : (
                <button
                  type="button" onClick={() => toggleIncluded(id)}
                  role="checkbox" aria-checked={on} aria-label={`${shortName(m, youMemberId)} is in the split`}
                  style={{ width: IN_COL, flexShrink: 0, display: 'inline-flex', justifyContent: 'center', padding: '6px 0', border: 0, background: 'transparent', cursor: 'pointer' }}
                >
                  <InBox on={on} />
                </button>
              )}

              <button
                type="button" onClick={() => toggleIncluded(id)} disabled={isPayer} tabIndex={-1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0,
                  padding: '4px 0', border: 0, background: 'transparent', textAlign: 'left',
                  cursor: isPayer ? 'default' : 'pointer', fontFamily: F,
                }}
              >
                <span style={{ display: 'inline-flex', flexShrink: 0, opacity: on ? 1 : 0.4, transition: 'opacity .15s ease' }}>
                  <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotById[id] ?? 0} size={28} isYou={id === youMemberId} />
                </span>
                <span style={{ minWidth: 0, fontSize: 14, fontWeight: 700, color: on ? T.ink : T.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {shortName(m, youMemberId)}
                </span>
                {isPayer && (
                  <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.inkFaint }}>
                    paid
                  </span>
                )}
              </button>

              <span style={{ minWidth: OWE_COL, display: 'inline-flex', justifyContent: 'flex-end', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                {!on ? (
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.inkFaint }}>—</span>
                ) : splitMode === 'exact' ? (
                  <Input
                    size="cell" prefix="$" alignRight fieldWidth={60}
                    type="number" inputMode="decimal" min={0}
                    value={exactAmounts[id] ?? ''}
                    onChange={e => setExactAmount(id, stripNegative(e.target.value))}
                    placeholder="0.00"
                    aria-label={`${shortName(m, youMemberId)} owes`}
                  />
                ) : splitMode === 'percentage' ? (
                  <>
                    <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 600, color: T.inkFaint, fontVariantNumeric: 'tabular-nums' }}>
                      {formatAmount(previewSplits?.[id] ?? pctDollars)}
                    </span>
                    <Input
                      size="cell" suffix="%" alignRight fieldWidth={38}
                      type="number" inputMode="decimal" min={0}
                      value={percents[id] ?? ''}
                      onChange={e => setPercent(id, stripNegative(e.target.value))}
                      placeholder="0"
                      aria-label={`${shortName(m, youMemberId)}'s percentage`}
                    />
                  </>
                ) : (
                  <span style={{ fontFamily: FH, fontSize: 15.5, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(owed)}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, minHeight: 32 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 12.8, fontWeight: 700, color: balanced ? T.inkMuted : T.coralInk }}>
          {status}
        </span>
        {!balanced && (
          <Btn onClick={evenOut} variant="soft" size="sm" style={{ flexShrink: 0 }}>Even it out</Btn>
        )}
      </div>
    </section>
  )
}
