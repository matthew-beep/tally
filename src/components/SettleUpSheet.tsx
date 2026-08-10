'use client'

import { useEffect, useState } from 'react'
import { T, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalContent } from '@/components/modal'
import { formatAmount, stripNegative } from '@/lib/money'
import { useCreateSettlements } from '@/queries/useSettlements'
import { SettleSuccess } from '@/components/settle/SettleSuccess'
import type { Transfer } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
  mySeatId: string
  transfers: Transfer[]
  preselect?: Transfer | null
}

type Screen = 'list' | 'record-payment' | 'success'

// Captured from the inserted rows so the status shown is the database's
// answer rather than a client re-derivation of the batch rule.
interface SettledSummary {
  amount: number
  status: 'pending' | 'confirmed'
}

// ── Record payment ──────────────────────────────────────────────────────
function RecordPaymentDrawer({
  transfer, isPending, onBack, onConfirm,
}: {
  transfer: Transfer
  isPending: boolean
  onBack: () => void
  onConfirm: (amount: number, note: string) => void
}) {
  const [amount, setAmount] = useState(transfer.amount.toFixed(2))
  const [note, setNote]     = useState('')

  const amt         = parseFloat(amount) || 0
  const canConfirm  = amt > 0 && !isPending
  const paying      = transfer.direction === 'owe'

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{ width: 32, height: 32, borderRadius: 10, background: T.surfaceAlt, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L3 7l6 5" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Avatar profile={transfer.avatar} slot={transfer.slot} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>
            {paying ? `Pay ${transfer.name}` : `Mark ${transfer.name} as paid`}
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>
            {paying ? 'You owe' : 'Owes you'} {formatAmount(transfer.amount)}
          </div>
        </div>
      </div>

      <div>
        <SectionLabel size="sm" style={{ padding: '0 4px 6px' }}>Amount</SectionLabel>
        <div style={{ background: T.surfaceAlt, borderRadius: 14, boxShadow: `inset 0 0 0 1px ${T.line}`, padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontSize: 18, color: T.inkMuted, fontFamily: FH, fontWeight: 500 }}>$</span>
          <input
            type="number" inputMode="decimal" min={0}
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
            style={{ width: '100%', border: 0, outline: 0, background: 'transparent', fontSize: 14, fontWeight: 500, color: T.ink, fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <button
        onClick={() => onConfirm(amt, note.trim())}
        disabled={!canConfirm}
        style={{
          width: '100%', padding: '13px', borderRadius: 14, border: 0,
          cursor: canConfirm ? 'pointer' : 'default', font: 'inherit', fontFamily: FH,
          fontSize: 14.5, fontWeight: 700,
          background: canConfirm ? T.sun : T.lineStrong, color: canConfirm ? T.sunInk : T.inkFaint,
          transition: 'all 0.18s',
        }}
      >{isPending ? 'Saving…' : paying ? `Pay ${formatAmount(amt)}` : 'Mark as paid'}</button>
    </ModalContent>
  )
}

// ── List ─────────────────────────────────────────────────────────────────
function TransferRow({ transfer, onTap }: { transfer: Transfer; onTap: () => void }) {
  const owed = transfer.direction === 'owed'
  return (
    <button
      onClick={onTap}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 4px', background: 'transparent', border: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
    >
      <Avatar profile={transfer.avatar} slot={transfer.slot} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{transfer.name}</div>
        <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 1 }}>{owed ? 'owes you' : 'you owe'}</div>
      </div>
      <div style={{ fontFamily: FH, fontSize: 14.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: owed ? T.mintInk : T.coralInk }}>
        {formatAmount(transfer.amount)}
      </div>
    </button>
  )
}

function ListDrawer({ transfers, onSelect }: { transfers: Transfer[]; onSelect: (t: Transfer) => void }) {
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
    </ModalContent>
  )
}

// ── Root sheet ──────────────────────────────────────────────────────────
export function SettleUpSheet({ open, onClose, groupId, mySeatId, transfers, preselect }: Props) {
  const createSettlements = useCreateSettlements()
  const [screen, setScreen]                 = useState<Screen>('list')
  const [activeTransfer, setActiveTransfer] = useState<Transfer | null>(null)
  const [settled, setSettled]               = useState<SettledSummary | null>(null)

  useEffect(() => {
    if (!open) return
    setSettled(null)
    if (preselect) {
      setActiveTransfer(preselect)
      setScreen('record-payment')
    } else {
      setActiveTransfer(null)
      setScreen('list')
    }
    // Keyed on the counterparty id, not the object itself — transfers are
    // rebuilt fresh every render, so identity-based deps would re-trigger
    // this (and stomp "back" navigation) on every unrelated parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect?.groupMemberId])

  function handleClose() {
    setScreen('list')
    setActiveTransfer(null)
    setSettled(null)
    onClose()
  }

  function handleSelect(t: Transfer) {
    setActiveTransfer(t)
    setScreen('record-payment')
  }

  async function handleConfirm(amount: number, note: string) {
    if (!activeTransfer) return
    // A batch of one. The from/to swap and the status rule both live in
    // buildSettlementBatch now — this sheet only says which group, whose
    // seats, how much, and which way.
    const rows = await createSettlements.mutateAsync({
      allocations: [{
        groupId,
        mySeatId,
        theirSeatId: activeTransfer.groupMemberId,
        amount,
        direction: activeTransfer.direction,
      }],
      note,
    })
    // Always a batch of one here — the group page is group-scoped by design.
    setSettled({ amount, status: rows[0].status })
    setScreen('success')
  }

  return (
    <ModalOrSheet open={open} onClose={handleClose} title="Settle up" maxWidth={420}>
      {screen === 'success' && settled && activeTransfer ? (
        <SettleSuccess
          name={activeTransfer.name}
          profile={activeTransfer.avatar}
          slot={activeTransfer.slot}
          amount={settled.amount}
          status={settled.status}
          groupCount={1}
          onDone={handleClose}
        />
      ) : screen === 'record-payment' && activeTransfer ? (
        <RecordPaymentDrawer
          transfer={activeTransfer}
          isPending={createSettlements.isPending}
          onBack={() => setScreen('list')}
          onConfirm={handleConfirm}
        />
      ) : (
        <ListDrawer transfers={transfers} onSelect={handleSelect} />
      )}
    </ModalOrSheet>
  )
}
