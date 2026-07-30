'use client'

import { useState } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalContent } from '@/components/modal'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements } from '@/queries/useSettlements'
import { useCurrentProfile } from '@/queries/useProfile'
import { calcNetBalances, simplifyDebts } from '@/lib/balance'
import { avatarProfile, displayName, firstName } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import type { DebtTransfer, GroupMember } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
}

type Screen = 'list' | 'record-payment'

const METHODS = [
  { id: 'venmo', label: 'Venmo', icon: '💸' },
  { id: 'zelle', label: 'Zelle', icon: '⚡' },
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
  { id: 'other', label: 'Other', icon: '🧾' },
]

function slotFor(members: { id: string }[], id: string): 0 | 1 | 2 | 3 {
  const idx = members.findIndex(m => m.id === id)
  return Math.max(0, idx) % 4 as 0 | 1 | 2 | 3
}

function stripNegative(v: string) {
  return v.replace(/-/g, '')
}

// ── Transfer row — shared shape for both "owed to you" and "you owe" ──────
function TransferRow({
  member, members, amount, amountColor, sign, actionLabel, actionStyle, onAction,
}: {
  member: GroupMember | undefined
  members: GroupMember[]
  amount: number
  amountColor: string
  sign: string
  actionLabel: string
  actionStyle: React.CSSProperties
  onAction: () => void
}) {
  const name = member ? displayName(member) : '…'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
      <Avatar profile={member ? avatarProfile(member) : undefined} slot={member ? slotFor(members, member.id) : 0} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{firstName(name)}</div>
        <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 600, letterSpacing: -0.4, color: amountColor, marginTop: 2 }}>
          {sign}{formatAmount(amount)}
        </div>
      </div>
      <button onClick={onAction} style={{ border: 0, cursor: 'pointer', font: 'inherit', padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, flexShrink: 0, ...actionStyle }}>
        {actionLabel}
      </button>
    </div>
  )
}

// ── Screen: list ────────────────────────────────────────────────────────
function SFSettleList({
  group, members, owedToYou, youOwe, onPay, onClose,
}: {
  group: { emoji: string; name: string } | undefined
  members: GroupMember[]
  owedToYou: DebtTransfer[]
  youOwe: DebtTransfer[]
  onPay: (t: DebtTransfer) => void
  onClose: () => void
}) {
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const empty = owedToYou.length === 0 && youOwe.length === 0

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        {group && <SectionLabel size="sm">{group.emoji} {group.name}</SectionLabel>}
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: T.ink, marginTop: 2 }}>Settle up</div>
      </div>

      {empty && (
        <div style={{ padding: '36px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
          <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 6 }}>All settled up!</div>
          <div style={{ fontSize: 13, color: T.inkMuted }}>No outstanding balances.</div>
        </div>
      )}

      {owedToYou.length > 0 && (
        <div>
          <SectionLabel style={{ padding: '0 4px 9px' }}>Owed to you</SectionLabel>
          <div style={{ background: T.surface, border: `0.5px solid ${T.line}`, borderRadius: 16, overflow: 'hidden' }}>
            {owedToYou.map((t, i) => (
              <div key={t.from} style={{ borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
                <TransferRow
                  member={memberById[t.from]} members={members} amount={t.amount}
                  amountColor={T.mintInk} sign="+"
                  actionLabel="Remind"
                  actionStyle={{ background: T.surfaceAlt, color: T.inkMuted }}
                  onAction={() => {}}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {youOwe.length > 0 && (
        <div>
          <SectionLabel style={{ padding: '0 4px 9px' }}>You owe</SectionLabel>
          <div style={{ background: T.surface, border: `0.5px solid ${T.line}`, borderRadius: 16, overflow: 'hidden' }}>
            {youOwe.map((t, i) => (
              <div key={t.to} style={{ borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
                <TransferRow
                  member={memberById[t.to]} members={members} amount={t.amount}
                  amountColor={T.coralInk} sign="−"
                  actionLabel="Pay"
                  actionStyle={{ background: T.coral, color: '#fff', boxShadow: `0 4px 12px ${T.coral}47` }}
                  onAction={() => onPay(t)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        style={{ width: '100%', padding: '13px', borderRadius: 13, background: 'transparent', border: 0, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, color: T.inkMuted }}
      >Close</button>
    </ModalContent>
  )
}

// ── Screen: record payment ─────────────────────────────────────────────
function SFRecordPayment({
  transfer, members, amount, setAmount, note, setNote, method, setMethod, onSubmit, onCancel,
}: {
  transfer: DebtTransfer
  members: GroupMember[]
  amount: string
  setAmount: (v: string) => void
  note: string
  setNote: (v: string) => void
  method: string | null
  setMethod: (v: string | null) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const person = memberById[transfer.to]
  const name = person ? displayName(person) : '…'

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 16px' }}>
        <Avatar profile={person ? avatarProfile(person) : undefined} slot={person ? slotFor(members, person.id) : 0} size={54} />
        <div style={{ textAlign: 'center', marginTop: 2 }}>
          <div style={{ fontSize: 13, color: T.inkMuted }}>
            Paying <b style={{ color: T.ink }}>{firstName(name)}</b>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3, marginTop: 8 }}>
            <span style={{ fontFamily: FH, fontSize: 26, fontWeight: 500, color: T.inkMuted }}>$</span>
            <input
              type="number" inputMode="decimal" min={0}
              value={amount}
              onChange={e => setAmount(stripNegative(e.target.value))}
              style={{ width: 140, textAlign: 'center', border: 'none', outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 44, fontWeight: 600, letterSpacing: -1.4, color: T.ink }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SectionLabel size="sm" style={{ marginBottom: 8, paddingLeft: 2 }}>Via</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METHODS.map(m => {
            const on = method === m.id
            return (
              <button
                key={m.id} type="button" onClick={() => setMethod(on ? null : m.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 999,
                  background: on ? T.ink : 'transparent', color: on ? T.bg : T.ink,
                  boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
                  border: 0, cursor: 'pointer', font: 'inherit',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14 }}>{m.icon}</span>{m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionLabel size="sm" style={{ marginBottom: 8, paddingLeft: 2 }}>Note (optional)</SectionLabel>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="My share of the trip"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: T.surfaceAlt, border: `1px solid ${T.line}`, fontSize: 14, color: T.ink, outline: 'none', fontFamily: F, boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onSubmit}
          style={{
            width: '100%', padding: '15px', borderRadius: 16,
            background: T.sun, color: T.sunInk, border: 0, cursor: 'pointer',
            font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
            boxShadow: '0 6px 20px rgba(242,192,74,0.32)',
          }}
        >
          Record payment · {formatAmount(parseFloat(amount) || 0)}
        </button>
        <button
          onClick={onCancel}
          style={{ width: '100%', padding: '14px', borderRadius: 16, background: T.surfaceAlt, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, color: T.inkMuted }}
        >Cancel</button>
      </div>
    </ModalContent>
  )
}

// ── Root sheet ──────────────────────────────────────────────────────────
export function SettleUpSheet({ open, onClose, groupId }: Props) {
  const { data: group }            = useGroup(groupId)
  const { data: members = [] }     = useGroupMembers(groupId)
  const { data: expenses = [] }    = useExpenses(groupId)
  const { data: settlements = [] } = useSettlements(groupId)
  const { data: profile }          = useCurrentProfile()

  const [screen, setScreen]           = useState<Screen>('list')
  const [activeTransfer, setActiveTransfer] = useState<DebtTransfer | null>(null)
  const [amount, setAmount]           = useState('')
  const [note, setNote]               = useState('')
  const [method, setMethod]           = useState<string | null>(null)

  const memberIds  = members.map(m => m.id)
  const net        = calcNetBalances(groupId, expenses, settlements, memberIds)
  const simplified = simplifyDebts(net)
  const myMember   = members.find(m => m.user_id === profile?.id)

  const myTransfers = myMember ? simplified.filter(t => t.from === myMember.id || t.to === myMember.id) : []
  const owedToYou    = myTransfers.filter(t => t.to === myMember?.id)
  const youOwe        = myTransfers.filter(t => t.from === myMember?.id)

  function handleClose() {
    setScreen('list')
    setActiveTransfer(null)
    setAmount('')
    setNote('')
    setMethod(null)
    onClose()
  }

  function handlePay(t: DebtTransfer) {
    setActiveTransfer(t)
    setAmount(t.amount.toFixed(2))
    setScreen('record-payment')
  }

  const title = screen === 'record-payment' ? 'Record payment' : (group ? `Settle up — ${group.name}` : 'Settle up')

  return (
    <ModalOrSheet open={open} onClose={handleClose} title={title} maxWidth={460}>
      {screen === 'record-payment' && activeTransfer && (
        <SFRecordPayment
          transfer={activeTransfer} members={members}
          amount={amount} setAmount={setAmount}
          note={note} setNote={setNote}
          method={method} setMethod={setMethod}
          onSubmit={handleClose}
          onCancel={() => setScreen('list')}
        />
      )}

      {screen === 'list' && (
        <SFSettleList
          group={group} members={members}
          owedToYou={owedToYou} youOwe={youOwe}
          onPay={handlePay} onClose={handleClose}
        />
      )}
    </ModalOrSheet>
  )
}
