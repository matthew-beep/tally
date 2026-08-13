'use client'

import { T, FH } from '@/design/tokens'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalContent } from '@/components/modal'
import { TransferRow } from '@/components/settle/TransferRow'
import { formatAmount } from '@/lib/money'
import type { Transfer } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  /** First name of the member whose balances these are — never "you" here. */
  subjectName: string
  transfers: Transfer[]
}

/**
 * Read-only counterpart to SettleUpSheet's list screen — lets you see how
 * someone else in the group stands with everyone, without a settle action.
 * Opened from clicking another member in the desktop Members column.
 */
export function MemberBalancesModal({ open, onClose, subjectName, transfers }: Props) {
  const owed = transfers.filter(t => t.direction === 'owed')
  const owe  = transfers.filter(t => t.direction === 'owe')
  const net  = owed.reduce((s, t) => s + t.amount, 0) - owe.reduce((s, t) => s + t.amount, 0)

  return (
    <ModalOrSheet open={open} onClose={onClose} title={`${subjectName}'s balances`} maxWidth={420}>
      <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>
            {subjectName}&rsquo;s balances
          </div>
          {transfers.length > 0 && (
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, marginTop: 4, color: Math.abs(net) < 0.01 ? T.inkFaint : net > 0 ? T.mintInk : T.coralInk }}>
              {formatAmount(net, { sign: true })} <span style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: T.inkFaint }}>net across the group</span>
            </div>
          )}
        </div>

        {owed.length > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <SectionLabel size="sm" style={{ padding: '0 4px 4px' }}>Owed to {subjectName}</SectionLabel>
            {owed.map(t => <TransferRow key={t.groupMemberId} transfer={t} />)}
          </div>
        )}

        {owe.length > 0 && (
          <div>
            <SectionLabel size="sm" style={{ padding: '0 4px 4px' }}>{subjectName} owes</SectionLabel>
            {owe.map(t => <TransferRow key={t.groupMemberId} transfer={t} />)}
          </div>
        )}

        {transfers.length === 0 && (
          <div style={{ padding: '20px 4px', fontSize: 13, color: T.inkMuted, textAlign: 'center' }}>All settled up 🎉</div>
        )}

        {transfers.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: T.inkFaint, textAlign: 'center' }}>
            You can only settle up your own balances.
          </div>
        )}
      </ModalContent>
    </ModalOrSheet>
  )
}
