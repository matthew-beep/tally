'use client'

import { useEffect, useState } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalContent } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { formatAmount, stripNegative } from '@/lib/money'
import { useCreateSettlements } from '@/queries/useSettlements'
import { SettleSuccess } from '@/components/settle/SettleSuccess'
import { TransferRow } from '@/components/settle/TransferRow'
import { TkTok } from '@/components/add-expense/TokenSentence'
import { PayerSheetContent } from '@/components/add-expense/PayerSheetContent'
import { shortName } from '@/components/add-expense/parts'
import { avatarProfile, displayName, slotFor } from '@/lib/memberDisplay'
import type { GroupMember, Transfer } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
  mySeatId: string
  transfers: Transfer[]
  /** All group members (slots are computed against the full list); the "Record a payment" picker shows the active ones, balance or not. */
  members: GroupMember[]
  preselect?: Transfer | null
}

type Screen = 'list' | 'record-payment' | 'success'

function memberTransfer(members: GroupMember[], m: GroupMember, amount: number, direction: Transfer['direction']): Transfer {
  return { groupMemberId: m.id, amount, direction, name: displayName(m), avatar: avatarProfile(m), slot: slotFor(members, m.id) }
}

// Captured from the inserted rows so the status shown is the database's
// answer rather than a client re-derivation of the batch rule.
interface SettledSummary {
  amount: number
  status: 'pending' | 'confirmed'
}

// ── Record payment ──────────────────────────────────────────────────────
// The one payment screen. Tapping a person in the list opens it prefilled
// (their side, the balance's direction and amount); "Record a payment" opens
// it blank. Either way it's "[You] paid [Sam]" with both sides tappable, like
// the add-expense payer token.
// One side is always you: settlements are written from my seat's perspective
// (batchStatus decides pending vs confirmed from that), so picking someone
// else on one side snaps the other side back to you.
function RecordPaymentDrawer({
  initial, members, mySeatId, transfers, isPending, onBack, onConfirm,
}: {
  initial: Transfer | null
  members: GroupMember[]
  mySeatId: string
  transfers: Transfer[]
  isPending: boolean
  onBack: () => void
  onConfirm: (fromId: string, toId: string, amount: number, note: string) => void
}) {
  // Pending invitees can't be paid yet; slots still come from the full list so colours match the page.
  const active = members.filter(m => m.status === 'active')
  const others = active.filter(m => m.id !== mySeatId)
  const theyPaid = initial?.direction === 'owed'
  const [fromId, setFromId]   = useState<string>(theyPaid ? initial.groupMemberId : mySeatId)
  const [toId, setToId]       = useState<string | null>(initial ? (theyPaid ? mySeatId : initial.groupMemberId) : others[0]?.id ?? null)
  const [picking, setPicking] = useState<'from' | 'to' | null>(null)
  const [amount, setAmount]   = useState(initial ? initial.amount.toFixed(2) : '')
  const [note, setNote]       = useState('')

  // The open balance that this from/to pair would settle, if any — the
  // prefilled amount. Opposite-direction balances don't suggest anything.
  function suggestedFor(from: string, to: string | null): string {
    const iPay = from === mySeatId
    const them = iPay ? to : from
    const t = them ? transfers.find(x => x.groupMemberId === them) : undefined
    return t && t.direction === (iPay ? 'owe' : 'owed') ? t.amount.toFixed(2) : ''
  }

  const memberById = Object.fromEntries(members.map(m => [m.id, m]))
  const amt        = parseFloat(amount) || 0
  const canConfirm = amt > 0 && !!toId && fromId !== toId && !isPending
  const theirId    = fromId === mySeatId ? toId : fromId
  const existing   = theirId ? transfers.find(t => t.groupMemberId === theirId) : undefined

  function pick(side: 'from' | 'to', id: string) {
    let from = side === 'from' ? id : fromId
    let to   = side === 'to'   ? id : toId
    const prev = side === 'from' ? fromId : toId
    // Picked the person already on the other side → swap them.
    if (side === 'from' && id === toId) to = prev
    if (side === 'to'   && id === fromId) from = prev ?? mySeatId
    // Neither side is me → the other side becomes me.
    if (from !== mySeatId && to !== mySeatId) {
      if (side === 'from') to = mySeatId
      else from = mySeatId
    }
    // Follow the new pair's balance unless the user has typed their own amount.
    if (amount === '' || amount === suggestedFor(fromId, toId)) setAmount(suggestedFor(from, to))
    setFromId(from)
    setToId(to)
    setPicking(null)
  }

  const word = { fontSize: 14, fontWeight: 600, color: T.inkMuted, letterSpacing: -0.1 }
  const token = (id: string | null, side: 'from' | 'to') => {
    const m = id ? memberById[id] : undefined
    const label = shortName(m, mySeatId)
    return (
      <TkTok
        open={picking === side}
        onClick={() => setPicking(p => (p === side ? null : side))}
        avatar={<Avatar profile={m ? avatarProfile(m) : undefined} slot={id ? slotFor(members, id) : 0} size={20} isYou={id === mySeatId} />}
      >{m ? (side === 'to' && label === 'You' ? 'you' : label) : 'Pick someone'}</TkTok>
    )
  }

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={picking ? () => setPicking(null) : onBack}
          style={{ width: 32, height: 32, borderRadius: 10, background: T.surfaceAlt, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L3 7l6 5" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>
          {picking === 'from' ? 'Who paid?' : picking === 'to' ? 'Who got paid?' : 'Record a payment'}
        </div>
      </div>

      {picking ? (
        <PayerSheetContent
          members={active}
          slotById={Object.fromEntries(members.map(m => [m.id, slotFor(members, m.id)]))}
          paidById={picking === 'from' ? fromId : toId}
          youMemberId={mySeatId}
          onSelect={id => pick(picking, id)}
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, rowGap: 8, fontFamily: F }}>
            {token(fromId, 'from')}
            <span style={word}>paid</span>
            {token(toId, 'to')}
          </div>

          {theirId && (
            <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: T.inkMuted, marginTop: -6 }}>
              {existing
                ? `${existing.direction === 'owe' ? 'You owe' : 'Owes you'} ${formatAmount(existing.amount)}`
                : 'No open balance'}
            </div>
          )}

          <div>
            <SectionLabel size="sm" style={{ padding: '0 4px 6px' }}>Amount</SectionLabel>
            <div style={{ background: T.surfaceAlt, borderRadius: 14, boxShadow: `inset 0 0 0 1px ${T.line}`, padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 18, color: T.inkMuted, fontFamily: FH, fontWeight: 500 }}>$</span>
              <input
                type="number" inputMode="decimal" min={0} placeholder="0.00"
                value={amount}
                onChange={e => setAmount(stripNegative(e.target.value))}
                style={{ border: 0, outline: 0, background: 'transparent', fontFamily: FH, fontSize: 26, fontWeight: 600, letterSpacing: -0.6, color: T.ink, width: '100%' }}
              />
            </div>
          </div>

          <div>
            <SectionLabel size="sm" style={{ padding: '0 4px 6px' }}>Note (optional)</SectionLabel>
            <div style={{ background: T.surfaceAlt, borderRadius: 14, boxShadow: `inset 0 0 0 1px ${T.line}`, padding: '10px 14px' }}>
              <input
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Venmo, cash, etc."
                style={{ width: '100%', border: 0, outline: 0, background: 'transparent', fontSize: 16, fontWeight: 500, color: T.ink, fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <Btn
            onClick={() => toId && onConfirm(fromId, toId, amt, note.trim())} disabled={!canConfirm} variant="primary" size="lg" fullWidth
            style={{ transition: 'all 0.18s' }}
          >{isPending ? 'Saving…' : canConfirm ? `Record ${formatAmount(amt)}` : 'Enter an amount'}</Btn>
        </>
      )}
    </ModalContent>
  )
}

// ── List ─────────────────────────────────────────────────────────────────
function ListDrawer({ transfers, onSelect, onCustom }: { transfers: Transfer[]; onSelect: (t: Transfer) => void; onCustom: () => void }) {
  const owed = transfers.filter(t => t.direction === 'owed')
  const owe  = transfers.filter(t => t.direction === 'owe')

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: T.ink, paddingBottom: 10 }}>Settle up</div>

      {owed.length > 0 && (
        <div style={{ paddingBottom: 8 }}>
          <SectionLabel size="sm" style={{ padding: '0 4px 4px' }}>Owed to you</SectionLabel>
          {owed.map(t => <TransferRow key={t.groupMemberId} transfer={t} onTap={() => onSelect(t)} />)}
        </div>
      )}

      {owe.length > 0 && (
        <div>
          <SectionLabel size="sm" style={{ padding: '0 4px 4px' }}>You owe</SectionLabel>
          {owe.map(t => <TransferRow key={t.groupMemberId} transfer={t} onTap={() => onSelect(t)} />)}
        </div>
      )}

      {transfers.length === 0 && (
        <div style={{ padding: '20px 4px', fontSize: 13, color: T.inkMuted, textAlign: 'center' }}>All settled up.</div>
      )}

      {/* Any payment between you and any member — not limited to open balances. */}
      <Btn onClick={onCustom} variant="primary" size="md" fullWidth style={{ marginTop: 8 }}>
        Record a payment
      </Btn>
    </ModalContent>
  )
}

// ── Root sheet ──────────────────────────────────────────────────────────
export function SettleUpSheet({ open, onClose, groupId, mySeatId, transfers, members, preselect }: Props) {
  const createSettlements = useCreateSettlements()
  const [screen, setScreen]   = useState<Screen>('list')
  // What the payment screen opens prefilled with — null = blank.
  const [initial, setInitial] = useState<Transfer | null>(null)
  // Who the saved payment was with, for the success screen.
  const [settledWith, setSettledWith] = useState<Transfer | null>(null)
  const [settled, setSettled] = useState<SettledSummary | null>(null)

  useEffect(() => {
    if (!open) return
    setSettled(null)
    setSettledWith(null)
    setInitial(preselect ?? null)
    setScreen(preselect ? 'record-payment' : 'list')
    // Keyed on the counterparty id, not the object itself — transfers are
    // rebuilt fresh every render, so identity-based deps would re-trigger
    // this (and stomp "back" navigation) on every unrelated parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect?.groupMemberId])

  function handleClose() {
    setScreen('list')
    setInitial(null)
    setSettledWith(null)
    setSettled(null)
    onClose()
  }

  function openPayment(t: Transfer | null) {
    setInitial(t)
    setScreen('record-payment')
  }

  // Exactly one of from/to is my seat (RecordPaymentDrawer guarantees it), so
  // every payment is a batch of one between me and one counterparty. The
  // from/to swap and the status rule both live in buildSettlementBatch.
  async function handleConfirm(fromId: string, toId: string, amount: number, note: string) {
    const iPaid   = fromId === mySeatId
    const counter = members.find(m => m.id === (iPaid ? toId : fromId))
    if (!counter) return
    const t = memberTransfer(members, counter, amount, iPaid ? 'owe' : 'owed')
    const rows = await createSettlements.mutateAsync({
      allocations: [{ groupId, mySeatId, theirSeatId: t.groupMemberId, amount, direction: t.direction }],
      note,
    })
    setSettledWith(t)
    setSettled({ amount, status: rows[0].status })
    setScreen('success')
  }

  return (
    <ModalOrSheet open={open} onClose={handleClose} title="Settle up" maxWidth={420}>
      {screen === 'success' && settled && settledWith ? (
        <SettleSuccess
          name={settledWith.name}
          profile={settledWith.avatar}
          slot={settledWith.slot}
          amount={settled.amount}
          status={settled.status}
          groupCount={1}
          onDone={handleClose}
        />
      ) : screen === 'record-payment' ? (
        <RecordPaymentDrawer
          // Remount per entry so the prefill is re-read each time.
          key={initial?.groupMemberId ?? 'blank'}
          initial={initial}
          members={members}
          mySeatId={mySeatId}
          transfers={transfers}
          isPending={createSettlements.isPending}
          onBack={() => setScreen('list')}
          onConfirm={handleConfirm}
        />
      ) : (
        <ListDrawer transfers={transfers} onSelect={openPayment} onCustom={() => openPayment(null)} />
      )}
    </ModalOrSheet>
  )
}
