'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { X } from 'lucide-react'
import { T, FH, F } from '@/design/tokens'
import { ModalOrSheet, ModalHeader, ModalContent } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { formatAmount, sanitizeAmount } from '@/lib/money'
import { CATEGORIES } from '@/lib/categories'
import { TokenSentence, ShareLine } from './TokenSentence'
import { PayerSheetContent } from './PayerSheetContent'
import { SplitSheetContent } from './SplitSheetContent'
import { DateSheetContent } from './DateSheetContent'
import { CategorySheetContent } from './CategorySheetContent'
import { ItemizedSheet } from './ItemizedSheet'
import type { AddExpenseFormState } from './useAddExpenseForm'

// Which field has the caret. Local to the layout — the hook has no opinion
// about what's focused, and the desktop panel has no keyboard to care about.
type Field = 'desc' | 'amount' | 'note' | null

const SUGGESTIONS = ['Dinner', 'Groceries', 'Gas', 'Tickets', 'Coffee'] as const

/** "Today" / "Yesterday" / "Mar 4" — the date said the way someone would say it. */
function dateLabel(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d))     return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

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

const ICON_LINES = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 4.2h10M3 8h10M3 11.8h6" />
  </svg>
)

const ICON_DATE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.2" y="2.8" width="13.6" height="12" rx="2.4" />
    <path d="M1.2 6.4h13.6M4.8 1.2v3M11.2 1.2v3" strokeLinecap="round" />
  </svg>
)

const ICON_RECEIPT = (
  <svg width="15" height="16" viewBox="0 0 16 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.6 1.6h10.8v13.8l-2.16-1.4-2.16 1.4-2.16-1.4-2.16 1.4L2.6 15.4z" />
    <path d="M5.4 5.4h5.2M5.4 8.4h5.2M5.4 11.4h3" />
  </svg>
)

const ICON_NOTE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
  </svg>
)

/**
 * One detail: icon, what it is, what it currently says, chevron. A full-width
 * row rather than a third of a horizontal strip, because these now live in the
 * flow of the form instead of on the bottom edge — there is width to spend, and
 * a row can show its value where a 33%-wide button could only show its label.
 */
function DetailRow({ icon, label, value, onClick, last }: {
  icon: ReactNode; label: string; value?: string; onClick: () => void; last?: boolean
}) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48,
        padding: '10px 0', border: 0, background: 'transparent', cursor: 'pointer',
        textAlign: 'left', fontFamily: F,
        borderBottom: last ? 'none' : `0.5px solid ${T.line}`,
      }}
    >
      <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: T.inkFaint, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: T.inkMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {value && (
        <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: T.ink, maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      )}
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 1l5 5-5 5" stroke={T.inkFaint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ── Mobile layout: the OS supplies both keyboards ───────────────────────────
// The amount used to be a readout driven by a hand-built keypad while the
// description got the system keyboard — two input surfaces for two fields an
// inch apart — and Date/Category/Note rode the bottom edge, rising with the
// custom pad and hiding under the system one. Three things fix that:
//
//   · both fields are ordinary inputs, so the OS picks the keyboard (digits for
//     one, letters for the other) and there is nothing of ours to get out of sync
//   · Save moves to the top bar, above any keyboard, so nothing has to stay
//     pinned to the bottom to remain reachable
//   · the form scrolls, and takes the details with it — they can't jump when a
//     keyboard opens because they were never anchored to the bottom
//
// `variant: 'route'` is used when this panel is the root of a full-screen page
// (/groups/[id]/add) instead of the Vaul sheet — same body, a close button
// instead of the sheet's Cancel.
export function MobilePanel({ s, onCancel, variant = 'sheet' }: { s: AddExpenseFormState; onCancel: () => void; variant?: 'sheet' | 'route' }) {
  const [field, setField] = useState<Field>(null)

  const amountRef = useRef<HTMLInputElement>(null)
  // Moving between two of our own fields fires blur before focus. Clearing the
  // field on a timer lets the incoming focus cancel it, so the layout doesn't
  // flicker through "no keyboard" on the way from the description to the amount.
  const blurTimer = useRef<number | null>(null)
  const focusField = (f: Field) => {
    if (blurTimer.current !== null) { clearTimeout(blurTimer.current); blurTimer.current = null }
    setField(f)
  }
  const blurField = () => {
    if (blurTimer.current !== null) clearTimeout(blurTimer.current)
    blurTimer.current = window.setTimeout(() => { setField(null); blurTimer.current = null }, 80)
  }
  useEffect(() => () => { if (blurTimer.current !== null) clearTimeout(blurTimer.current) }, [])

  const isItemized  = s.splitMode === 'itemized'
  const shownAmount = isItemized ? (s.itemTotal > 0 ? s.itemTotal.toFixed(2) : '') : s.amount
  const hasAmount   = isItemized ? s.itemTotal > 0 : s.amt > 0
  const categoryLabel = CATEGORIES.find(c => c.emoji === s.category)?.label ?? 'Other'

  const itemCount   = s.items.length
  const receiptValue = !isItemized || itemCount === 0
    ? ''
    : `${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatAmount(s.itemTotal)}`

  // Opening the sheet changes nothing — you can go and look at a bill, or start
  // one and abandon it, without the expense quietly switching split mode
  // underneath you. The receipt only takes over when its own commit button says
  // so, which is what `useReceipt` is.
  function openReceipt() {
    s.setOpenPanel('receipt')
  }

  function useReceipt() {
    s.setSplitMode('itemized')
    s.setAmount(s.itemTotal.toFixed(2))
    s.setOpenPanel(null)
  }

  // Emptying a receipt that was already driving the split is a way of undoing
  // it, so it puts the expense back on equal shares rather than leaving it in a
  // mode with nothing in it. The last total stays in the amount field — it is
  // still the number the user entered.
  function closeReceipt() {
    if (isItemized && s.items.length === 0) s.setSplitMode('equal')
    s.setOpenPanel(null)
  }

  // Keeps the hook's blocking messages ("Balance to 100% first") rather than
  // replacing them with a cheerful amount the user can't actually save.
  const commitLabel =
    s.isPending   ? 'Saving…' :
    isItemized    ? 'Itemized — coming soon' :
    !s.splitValid ? s.saveLabel :
    s.amt > 0     ? `Add ${formatAmount(s.amt)}` :
                    'Add expense'

  const underline = (on: boolean, pad: number) => ({
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', paddingBottom: pad,
    borderBottom: `1.5px solid ${on ? T.sun : T.line}`,
    transition: 'border-color .14s ease',
  })

  return (
    <div
      className="add-expense-panel add-expense-panel--mobile"
    >
      {/* Save lives up here, above every keyboard. That one move is what frees
          the rest of the screen from having to keep anything pinned. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px 8px', flexShrink: 0 }}>
        {variant === 'route' ? (
          <button
            type="button" onClick={onCancel} aria-label="Close"
            style={{ width: 36, height: 36, borderRadius: T.r.md, background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.ink }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button" onClick={onCancel}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: F, fontSize: 15, fontWeight: 600, color: T.inkMuted, padding: '8px 6px', flexShrink: 0 }}
          >Cancel</button>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '6px 12px', borderRadius: T.r.pill,
          fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink,
          background: T.surface, boxShadow: T.shadowRaised,
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{s.groupLabel}</span>
        <button
          type="button" onClick={s.handleSave} disabled={!s.canSave || s.isPending}
          style={{
            background: 'transparent', border: 0, padding: '8px 6px', flexShrink: 0,
            cursor: s.canSave && !s.isPending ? 'pointer' : 'default',
            fontFamily: FH, fontSize: 15.5, fontWeight: 700, letterSpacing: -0.2,
            color: s.canSave && !s.isPending ? T.ink : T.inkFaint,
            transition: 'color .14s ease',
          }}
        >{s.isPending ? 'Saving…' : 'Save'}</button>
      </div>


      <div className="add-expense-mobile-body">
        {/* what it was for */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Glyph>{ICON_LINES}</Glyph>
          <span style={underline(field === 'desc', 8)}>
            <input
              autoFocus
              value={s.description}
              onChange={e => s.setDescription(e.target.value)}
              onFocus={() => focusField('desc')}
              onBlur={blurField}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); amountRef.current?.focus() } }}
              enterKeyHint="next"
              placeholder="What was it for?"
              style={{
                flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', padding: 0,
                color: T.ink, fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5,
              }}
            />
          </span>
        </div>

        {/* how much — inputMode picks the OS number pad; in itemized mode the
            items own the total, so the field states it read-only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Glyph><span style={{ fontFamily: FH, fontSize: 19, fontWeight: 700 }}>$</span></Glyph>
          <span style={underline(field === 'amount', 6)}>
            <input
              ref={amountRef}
              value={shownAmount}
              readOnly={isItemized}
              onChange={e => s.setAmount(sanitizeAmount(e.target.value))}
              onFocus={() => { if (!isItemized) focusField('amount') }}
              onBlur={blurField}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0.00"
              aria-label="Amount"
              style={{
                flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', padding: 0,
                fontFamily: FH, fontSize: 36, fontWeight: 700, letterSpacing: -1.4,
                fontVariantNumeric: 'tabular-nums', color: hasAmount ? T.ink : T.inkFaint,
              }}
            />
            {isItemized && (
              <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 8, alignSelf: 'flex-end', paddingBottom: 5, flexShrink: 0 }}>
                from items
              </span>
            )}
          </span>
        </div>

        {/* who paid and how it splits, plus what that costs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 2 }}>
          <TokenSentence s={s} />
          {hasAmount && <ShareLine s={s} />}
        </div>

        {/* The three details, in reading order after the things that matter
            more. They scroll with the form, which is the whole point — there is
            no bottom edge for them to be shoved off any more. */}
        <div style={{ borderTop: `0.5px solid ${T.line}`, paddingTop: 4, marginTop: 4 }}>
          {/* Itemizing used to be a fourth tab in the split sheet, sitting
              beside Equal/Exact/Percent as though it were another way of
              dividing a number you had already typed. It isn't — a receipt
              *produces* the number. So it comes out of that sheet and becomes a
              row of the form, above Date, next to the amount it decides. */}
          <DetailRow icon={ICON_RECEIPT} label="Itemize the bill" value={receiptValue} onClick={openReceipt} />
          <DetailRow icon={ICON_DATE} label="Date" value={dateLabel(s.expenseDate)} onClick={() => s.setOpenPanel('date')} />
          <DetailRow icon={<span style={{ fontSize: 14 }}>{s.category}</span>} label="Category" value={categoryLabel} onClick={() => s.setOpenPanel('category')} />

          {/* The note is a line of the form you type into, not a sheet with its
              own Save. 16px is a hard floor, not a design choice — iOS Safari
              auto-zooms the viewport on focus for anything smaller. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0' }}>
            <span style={{ width: 20, marginTop: 3, display: 'inline-flex', justifyContent: 'center', flexShrink: 0, color: field === 'note' || s.note ? T.inkMuted : T.inkFaint }}>{ICON_NOTE}</span>
            <textarea
              value={s.note}
              onChange={e => s.setNote(e.target.value)}
              onFocus={() => focusField('note')}
              onBlur={blurField}
              rows={field === 'note' || s.note ? 3 : 1}
              placeholder="Add a note"
              style={{
                flex: 1, minWidth: 0, resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: 0,
                fontFamily: F, fontSize: 16, fontWeight: 600, lineHeight: 1.45, color: T.ink,
              }}
            />
          </div>
        </div>

        {/* Clearance so the last row sits clear of the commit button — and,
            once a keyboard is up, so the note has somewhere to scroll to
            instead of the browser panning the whole page to reveal it. Constant
            now that the button no longer rises with the keyboard. */}
        <div style={{ height: 72, flexShrink: 0 }} />
      </div>


      {/* Stays on the bottom edge of the screen and lets the keyboard slide up
          over it, rather than riding the keyboard's top edge. Save is in the
          top bar, above every keyboard, so nothing is unreachable while it's
          covered — and the form doesn't lurch every time a field is focused. */}
      <div style={{ flexShrink: 0, padding: '10px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
        <Btn
          onClick={s.handleSave} disabled={!s.canSave || s.isPending} variant="primary" size="lg" fullWidth
          style={{ borderRadius: 15, padding: '17px', fontSize: 17, fontFamily: FH, letterSpacing: -0.2 }}
        >{commitLabel}</Btn>
      </div>
      

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

      {/* Pinned tall via `itemize-sheet-root`: the composer keeps one place on
          screen however long the bill gets, and the totals footer sits outside
          the scroller instead of scrolling away under the last line. */}
      <ModalOrSheet
        open={s.openPanel === 'receipt'} onClose={closeReceipt} title="Itemize"
        sheetContentClassName="itemize-sheet-root" panelClassName="itemize-sheet-root"
        sheetContentStyle={{ background: T.bg }}
        panelStyle={{ background: T.bg }}
      >
        <ItemizedSheet s={s} onClose={closeReceipt} onUse={useReceipt} />
      </ModalOrSheet>
    </div>
  )
}
