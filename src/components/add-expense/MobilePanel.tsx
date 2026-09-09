'use client'

import { useState, type ReactNode } from 'react'
import { T, FH, F } from '@/design/tokens'
import { ModalOrSheet, ModalHeader, ModalContent } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { formatAmount } from '@/lib/money'
import { TokenSentence, ShareLine } from './TokenSentence'
import { UtilityRow } from './UtilityRow'
import { NumericPad } from './NumericPad'
import { PayerSheetContent } from './PayerSheetContent'
import { SplitSheetContent } from './SplitSheetContent'
import { DateSheetContent } from './DateSheetContent'
import { CategorySheetContent } from './CategorySheetContent'
import { NoteSheetContent } from './NoteSheetContent'
import type { AddExpenseFormState } from './useAddExpenseForm'

// Which field owns the bottom slab. Local to the layout — the hook has no
// opinion about what's focused, and the desktop panel has no slab at all.
type Field = 'desc' | 'amount' | null

const SUGGESTIONS = [
  ['🍜', 'Dinner'], ['🛒', 'Groceries'], ['⛽', 'Gas'], ['🎟️', 'Tickets'], ['🏠', 'Airbnb'],
] as const

// The recessed square that marks each field — a trough, matching every other
// "put a value here" surface in the app.
function Glyph({ children }: { children: ReactNode }) {
  return (
    <span style={{
      width: 40, height: 40, flexShrink: 0, borderRadius: T.r.md,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: T.inkMuted, background: T.sink, boxShadow: T.shadowRecessed,
    }}>{children}</span>
  )
}

function DescSuggestions({ onPick, onNext }: { onPick: (label: string) => void; onNext: () => void }) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
      padding: '10px 14px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
    }}>
      <Btn
        onClick={onNext} variant="primary" size="lg" fullWidth
        style={{ borderRadius: 15, padding: '15px', fontSize: 17, fontFamily: FH, letterSpacing: -0.2 }}
      >Next</Btn>
    </div>
  )
}

// ── Mobile layout: two fields and a sentence, centered; one input slab ───────
// The screen no longer scrolls. Everything about *how* the expense splits lives
// in SplitSheetContent behind the [equally] token, and the three details that
// aren't the split live in UtilityRow — which is what leaves room for the body
// to sit centered at any phone height.
//
// `variant: 'route'` is used when this panel is the root of a full-screen page
// (/groups/[id]/add) instead of the Vaul sheet — same body, a back-button nav
// bar instead of the sheet's Cancel + centered group pill.
export function MobilePanel({ s, onCancel, variant = 'sheet' }: { s: AddExpenseFormState; onCancel: () => void; variant?: 'sheet' | 'route' }) {
  const [field, setField] = useState<Field>('desc')

  const isItemized  = s.splitMode === 'itemized'
  const shownAmount = isItemized
    ? (s.itemTotal > 0 ? s.itemTotal.toFixed(2) : '0.00')
    : (s.amount || '0.00')
  const hasAmount = isItemized ? s.itemTotal > 0 : s.amt > 0

  // Keeps the hook's blocking messages ("Balance to 100% first") rather than
  // replacing them with a cheerful amount the user can't actually save.
  const commitLabel =
    s.isPending   ? 'Saving…' :
    isItemized    ? 'Itemized — coming soon' :
    !s.splitValid ? s.saveLabel :
    s.amt > 0     ? `Add ${formatAmount(s.amt)}` :
                    'Add expense'

  return (
    <div className="add-expense-panel add-expense-panel--mobile border-2">
      {variant === 'route' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 8px', flexShrink: 0 }}>
          <button
            type="button" onClick={onCancel} aria-label="Back"
            style={{ width: 36, height: 36, borderRadius: T.r.md, background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke={T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={{ flex: 1, fontFamily: F, fontSize: 15.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink }}>Add expense</span>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkMuted, background: T.surfaceAlt, padding: '4px 12px', borderRadius: 999, flexShrink: 0 }}>
            {s.groupLabel}
          </div>
        </div>
      ) : (
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
      )}

      <div className="add-expense-mobile-body">
        {/* what it was for */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Glyph>
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 4.2h10M3 8h10M3 11.8h6" />
            </svg>
          </Glyph>
          <input
            autoFocus
            value={s.description}
            onChange={e => s.setDescription(e.target.value)}
            onFocus={() => setField('desc')}
            placeholder="Enter a description"
            style={{
              flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent',
              color: T.ink, fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5,
              paddingBottom: 8, borderBottom: `1.5px solid ${field === 'desc' ? T.sun : T.line}`,
              transition: 'border-color .14s ease',
            }}
          />
        </div>

        {/* how much — a readout driven by the pad, or by the items in itemized mode */}
        <button
          type="button" disabled={isItemized}
          onClick={() => setField('amount')}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            textAlign: 'left', border: 0, background: 'transparent', padding: 0,
            cursor: isItemized ? 'default' : 'pointer', fontFamily: F,
          }}
        >
          <Glyph><span style={{ fontFamily: FH, fontSize: 19, fontWeight: 700 }}>$</span></Glyph>
          <span style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', paddingBottom: 6,
            borderBottom: `1.5px solid ${field === 'amount' ? T.sun : T.line}`,
            transition: 'border-color .14s ease',
          }}>
            <span style={{
              fontFamily: FH, fontSize: 36, fontWeight: 700, letterSpacing: -1.4,
              fontVariantNumeric: 'tabular-nums', color: hasAmount ? T.ink : T.inkFaint,
            }}>{shownAmount}</span>
            {field === 'amount' && !isItemized && <span className="add-expense-caret" />}
            {isItemized && (
              <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 8, alignSelf: 'flex-end', paddingBottom: 5 }}>
                from items
              </span>
            )}
          </span>
        </button>

        {/* who paid and how it splits, plus what that costs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 2 }}>
          <TokenSentence s={s} />
          {hasAmount && <ShareLine s={s} />}
        </div>
      </div>

      <UtilityRow s={s} />

      {field === 'amount' && !isItemized ? (
        <NumericPad
          value={s.amount} onChange={s.setAmount}
          // The label has to be honest: it only says "Add" when tapping it
          // actually saves. Otherwise it just commits the amount and steps back.
          onAction={() => { if (s.canSave && !s.isPending) s.handleSave(); else setField(null) }}
          actionLabel={s.canSave ? `Add ${formatAmount(s.amt)}` : 'Done'}
          actionOn={s.amt > 0}
        />
      ) : field === 'desc' ? (
        <DescSuggestions
          onPick={label => { s.setDescription(label); setField('amount') }}
          onNext={() => setField('amount')}
        />
      ) : (
        <div style={{ flexShrink: 0, padding: '10px 14px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
          <Btn
            onClick={s.handleSave} disabled={!s.canSave || s.isPending} variant="primary" size="lg" fullWidth
            style={{ borderRadius: 15, padding: '17px', fontSize: 17, fontFamily: FH, letterSpacing: -0.2 }}
          >{commitLabel}</Btn>
        </div>
      )}

      <ModalOrSheet open={s.openPanel === 'payer'} onClose={() => s.setOpenPanel(null)} title="Paid by">
        <ModalHeader title="Paid by" onClose={() => s.setOpenPanel(null)} />
        <ModalContent>
          <PayerSheetContent
            members={s.members} slotById={s.slotById} paidById={s.paidById} youMemberId={s.youMemberId}
            onSelect={id => { s.setPaidById(id); s.setOpenPanel(null) }}
          />
        </ModalContent>
      </ModalOrSheet>

      <ModalOrSheet open={s.openPanel === 'split'} onClose={() => s.setOpenPanel(null)} title="Split">
        <ModalHeader title="Split" onClose={() => s.setOpenPanel(null)} />
        <ModalContent>
          <SplitSheetContent s={s} onDone={() => s.setOpenPanel(null)} />
        </ModalContent>
      </ModalOrSheet>

      <ModalOrSheet open={s.openPanel === 'date'} onClose={() => s.setOpenPanel(null)} title="Date">
        <ModalHeader title="Date" onClose={() => s.setOpenPanel(null)} />
        <ModalContent>
          <DateSheetContent value={s.expenseDate} onSelect={d => { s.setExpenseDate(d); s.setOpenPanel(null) }} />
        </ModalContent>
      </ModalOrSheet>

      <ModalOrSheet open={s.openPanel === 'category'} onClose={() => s.setOpenPanel(null)} title="Category">
        <ModalHeader title="Category" onClose={() => s.setOpenPanel(null)} />
        <ModalContent>
          <CategorySheetContent category={s.category} onSelect={emoji => { s.selectCategory(emoji); s.setOpenPanel(null) }} />
        </ModalContent>
      </ModalOrSheet>

      <ModalOrSheet open={s.openPanel === 'note'} onClose={() => s.setOpenPanel(null)} title="Note">
        <ModalHeader title="Note" onClose={() => s.setOpenPanel(null)} />
        <ModalContent>
          <NoteSheetContent value={s.note} onChange={s.setNote} />
        </ModalContent>
      </ModalOrSheet>
    </div>
  )
}
