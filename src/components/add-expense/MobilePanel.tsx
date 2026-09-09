'use client'

import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { T, FH, F } from '@/design/tokens'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalHeader, ModalContent } from '@/components/modal'
import { CATEGORIES } from '@/lib/categories'
import { Hairline, Chevron } from './parts'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { AmountInput } from '@/components/AmountInput'
import { TokenSentence, ShareLine } from './TokenSentence'
import { PayerSheetContent } from './PayerSheetContent'
import { SplitSheetContent } from './SplitSheetContent'
import { DateSheetContent } from './DateSheetContent'
import { CategorySheetContent } from './CategorySheetContent'
import { NoteSheetContent } from './NoteSheetContent'
import type { AddExpenseFormState } from './useAddExpenseForm'

// A tappable summary row — label left, value + chevron right. Opens a picker
// sheet on tap; `open` means "that sheet is currently open," not "expanded inline."
function SummaryRow({ label, value, open, onClick }: {
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

// ── Mobile layout: title + amount, summary rows, save ──────────────────
// The split itself (method, who is in, how much) lives in SplitSheetContent,
// opened from the Split row — not inline on this screen.
// `variant: 'route'` is used when this panel is the root of a full-screen page
// (/groups/[id]/add) instead of the Vaul sheet — same body, a back-button nav
// bar instead of the sheet's Cancel + centered group pill.
export function MobilePanel({ s, onCancel, variant = 'sheet' }: { s: AddExpenseFormState; onCancel: () => void; variant?: 'sheet' | 'route' }) {
  const isItemized = s.splitMode === 'itemized'
  const saveLabel = s.isPending ? 'Saving…' : isItemized ? 'Itemized — coming soon' : 'Save expense'

  return (
    <div className="add-expense-panel add-expense-panel--mobile">
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
            <AmountInput
              value={s.amount} onChange={s.setAmount}
              inputClassName="add-expense-amount-input"
            />
          )}
        </div>

        <Hairline />

        <div style={{ padding: '20px 0 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <TokenSentence s={s} />
          {(isItemized ? s.itemTotal > 0 : s.amt > 0) && <ShareLine s={s} />}
        </div>

        <Hairline />

        <div style={{ padding: '14px 0 2px' }}>
          <SectionLabel size="sm" color={T.inkFaint} style={{ marginBottom: 2 }}>Details</SectionLabel>

          <SummaryRow
            label="Date" open={s.openPanel === 'date'}
            onClick={() => s.setOpenPanel('date')}
            value={
              <span style={{ fontSize: 15, fontWeight: 500, color: s.openPanel === 'date' ? T.sun : T.inkMuted }}>
                {format(parseISO(s.expenseDate), 'MMM d, yyyy')}
              </span>
            }
          />
          <Hairline />
          <SummaryRow
            label="Category" open={s.openPanel === 'category'}
            onClick={() => s.setOpenPanel('category')}
            value={
              <>
                <span style={{ fontSize: 16 }}>{s.category}</span>
                <span style={{ fontSize: 15, fontWeight: 500, color: s.openPanel === 'category' ? T.sun : T.inkMuted }}>
                  {CATEGORIES.find(c => c.emoji === s.category)?.label ?? 'Other'}
                </span>
              </>
            }
          />
          <Hairline />
          <SummaryRow
            label="Note" open={s.openPanel === 'note'}
            onClick={() => s.setOpenPanel('note')}
            value={
              <span style={{ fontSize: 15, fontWeight: 500, color: s.note ? (s.openPanel === 'note' ? T.sun : T.inkMuted) : T.inkFaint }}>
                {s.note ? (s.note.length > 28 ? s.note.slice(0, 28) + '…' : s.note) : 'Add a note'}
              </span>
            }
          />
        </div>

        <Hairline />

        {/* Save scrolls with the body rather than pinning to the bottom. A
            pinned footer sat at the bottom of a 100dvh box, and iOS Safari
            doesn't shrink dvh for the software keyboard — so on focus the
            footer drifted upward with the panel instead of holding still.
            In flow there's nothing to track. */}
        <div style={{ paddingTop: 22, paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
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
