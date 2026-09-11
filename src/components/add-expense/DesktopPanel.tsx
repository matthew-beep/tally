'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { T, F, FMONO, well } from '@/design/tokens'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalHeader } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { AmountInput } from '@/components/AmountInput'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatAmount, round2 } from '@/lib/money'
import { AnchoredPopover } from './AnchoredPopover'
import { FilingRow } from './FilingRow'
import { PayerSheetContent } from './PayerSheetContent'
import { SplitLedger } from './SplitLedger'
import { TokenSentence } from './TokenSentence'
import { shortName, fmtPct } from './parts'
import type { AddExpenseFormState } from './useAddExpenseForm'

// The narrowest viewport the 1010px dialog fits in with the modal's 24px
// gutters. Below it the ledger opens under the sentence instead of beside it,
// and the dialog stays narrow.
const ROOM_BESIDE = '(min-width: 1080px)'

const ICON_NOTE = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
  </svg>
)

const ICON_ITEMS = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2.5 4.2h6M2.5 8h6M2.5 11.8h4" /><path d="M11.5 4.2h2M11.5 8h2M11.5 11.8h2" />
  </svg>
)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <SectionLabel color={T.inkFaint}>{label}</SectionLabel>
      {children}
    </label>
  )
}

/**
 * The note as a field in its own right — a recessed well matching What for and
 * How much, rather than a line of text floating under them. It posts as the
 * expense's first comment on save (see useAddExpenseForm.handleSave).
 */
function NoteWell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginTop: 13 }}>
      <Field label="Note">
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 14, ...well(focused) }}>
          <span style={{ marginTop: 3, display: 'inline-flex', flexShrink: 0, color: value || focused ? T.inkMuted : T.inkFaint }}>{ICON_NOTE}</span>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={2}
            placeholder="Anything the group should know — they can all read it"
            style={{
              flex: 1, minWidth: 0, resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: 0,
              color: T.ink, caretColor: T.sun, fontFamily: F, fontSize: 14, fontWeight: 600, lineHeight: 1.5,
            }}
          />
        </span>
      </Field>
    </div>
  )
}

/**
 * Where itemizing will live — an action row under the note, the same place the
 * mobile form puts it. A stub for now: saving an itemized expense needs the
 * expense_item_assignments migration first, so the row is present but inert.
 */
function ItemizeStub() {
  return (
    <button
      type="button" disabled aria-disabled="true"
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 52, marginTop: 13,
        padding: '10px 14px', borderRadius: 14, border: 0, cursor: 'default', textAlign: 'left',
        fontFamily: F, color: T.ink, background: 'transparent', boxShadow: T.shadowHair,
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0, color: T.inkFaint }}>{ICON_ITEMS}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.inkMuted }}>Split by item</span>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: T.inkFaint, marginTop: 1 }}>
          Coming soon — enter the lines on the bill and assign each one
        </span>
      </span>
    </button>
  )
}

/**
 * The outcome, said once, next to Save — what you will actually be owed or
 * owe, not how the split is configured (the sentence already says that). Reads
 * `previewSplits`, so it quotes the same cents Save will write; while the
 * split doesn't add up it says what's missing instead.
 */
function OutcomeLine({ s }: { s: AddExpenseFormState }) {
  const base = { fontFamily: F, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const
  const strong = { color: T.ink, fontWeight: 800, fontFamily: FMONO }

  if (!s.description.trim() || s.amt <= 0) {
    return <span style={{ ...base, fontWeight: 600, color: T.inkFaint }}>Enter a description and an amount</span>
  }
  if (s.splitMode === 'itemized') {
    return <span style={{ ...base, color: T.inkMuted }}>Itemized splits are coming soon</span>
  }

  const preview = s.previewSplits
  if (!preview || !s.paidById) {
    const text =
      s.splitMode === 'exact'
        ? `${formatAmount(Math.abs(s.exactRemaining))} ${s.exactRemaining > 0 ? 'left to assign' : 'over'}`
        : s.splitMode === 'percentage'
          ? `${fmtPct(Math.abs(s.percentRemaining))}% ${s.percentRemaining > 0 ? 'left to assign' : 'over'}`
          : 'Pick at least one person'
    return <span style={{ ...base, color: T.coralInk }}>{text}</span>
  }

  const total = formatAmount(s.amt)
  const others = Object.keys(preview).filter(id => id !== s.paidById && preview[id] > 0)

  let body: ReactNode
  if (s.paidById === s.youMemberId) {
    if (others.length === 0) {
      body = <>You paid <span style={strong}>{total}</span> · only you in this split</>
    } else {
      const owedToYou = round2(others.reduce((a, id) => a + preview[id], 0))
      const who = others.length === 1
        ? `${shortName(s.memberById[others[0]], s.youMemberId)} owes`
        : `${others.length} people owe`
      body = <>You paid <span style={strong}>{total}</span> · {who} you <span style={strong}>{formatAmount(owedToYou)}</span></>
    }
  } else {
    const payer = shortName(s.memberById[s.paidById], s.youMemberId)
    const mine = s.youMemberId ? preview[s.youMemberId] : undefined
    body = mine
      ? <>{payer} paid <span style={strong}>{total}</span> · you owe <span style={strong}>{formatAmount(mine)}</span></>
      : <>{payer} paid <span style={strong}>{total}</span> · you&rsquo;re not in this one</>
  }

  return <span style={{ ...base, color: T.inkMuted }}>{body}</span>
}

/**
 * Desktop add expense — one dialog, two widths.
 *
 * At rest it is 560px and states the arrangement as a sentence: "Paid by [you]
 * and split [equally]". The payer token opens a popover; the split token slides
 * a ledger out beside the form and widens the dialog to 1010px (reported to
 * AddExpenseSheet through `onWideChange`, which owns the modal's width). On a
 * viewport too narrow for that, the ledger opens under the sentence instead.
 */
export function DesktopPanel({ s, onCancel, onWideChange }: {
  s: AddExpenseFormState
  onCancel: () => void
  onWideChange?: (wide: boolean) => void
}) {
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [payerOpen, setPayerOpen] = useState(false)
  const payerRef = useRef<HTMLSpanElement>(null)
  const roomBeside = useMediaQuery(ROOM_BESIDE)
  const side = ledgerOpen && roomBeside

  useEffect(() => { onWideChange?.(side) }, [side, onWideChange])
  // Unmounting (the dialog closing, or the viewport dropping to mobile) must
  // hand the width back, or the next open would start wide.
  useEffect(() => () => onWideChange?.(false), [onWideChange])

  const compose = (
    <>
      <FilingRow s={s} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 168px', gap: 14, alignItems: 'end' }}>
        <Field label="What for">
          <Input
            size="field" fullWidth autoFocus
            value={s.description} onChange={e => s.setDescription(e.target.value)}
            placeholder="Enter a description"
          />
        </Field>
        <Field label="How much">
          <AmountInput size="fieldLg" value={s.amount} onChange={s.setAmount} />
        </Field>
      </div>

      <NoteWell value={s.note} onChange={s.setNote} />
      <ItemizeStub />

      {/* The only statement of who paid and how it splits while the ledger is
          shut — and the way into both. */}
      <div style={{ marginTop: 18 }}>
        <TokenSentence
          s={s} align="start" payerRef={payerRef}
          payerOpen={payerOpen} onPayer={() => setPayerOpen(o => !o)}
          splitOpen={ledgerOpen} onSplit={() => { setLedgerOpen(o => !o); setPayerOpen(false) }}
        />
      </div>

      {ledgerOpen && !roomBeside && (
        <SplitLedger s={s} placement="below" onClose={() => setLedgerOpen(false)} />
      )}
    </>
  )

  return (
    // A form so Enter in any field saves — through the one submit button, which
    // the browser won't press while it's disabled.
    <form
      className="add-expense-panel add-expense-panel--desktop"
      onSubmit={e => { e.preventDefault(); if (s.canSave) void s.handleSave() }}
    >
      <ModalHeader title="Add an expense" onClose={onCancel} style={{ borderBottom: 'none', padding: '22px 26px 16px' }} />

      <div className="add-expense-desktop-body">
        {side ? (
          <div className="add-expense-desktop-split">
            <div style={{ minWidth: 0 }}>{compose}</div>
            <SplitLedger s={s} placement="side" onClose={() => setLedgerOpen(false)} />
          </div>
        ) : compose}
      </div>

      <footer className="add-expense-desktop-footer">
        <span style={{ flex: 1, minWidth: 0, display: 'flex' }}><OutcomeLine s={s} /></span>
        <Btn onClick={onCancel} variant="outline" size="md" style={{ padding: '10px 16px', borderRadius: 12 }}>Cancel</Btn>
        <Btn
          type="submit" disabled={!s.canSave || s.isPending} variant="primary" size="md"
          style={{ padding: '10px 20px', borderRadius: 12, fontSize: 14.5, letterSpacing: -0.2 }}
        >{s.saveLabel}</Btn>
      </footer>

      <AnchoredPopover open={payerOpen} anchorRef={payerRef} onClose={() => setPayerOpen(false)} width={232} label="Paid by">
        <div style={{ padding: '0 7px' }}>
          <PayerSheetContent
            members={s.members} slotById={s.slotById} paidById={s.paidById} youMemberId={s.youMemberId}
            onSelect={id => { s.setPaidById(id); setPayerOpen(false) }}
          />
        </div>
      </AnchoredPopover>
    </form>
  )
}
