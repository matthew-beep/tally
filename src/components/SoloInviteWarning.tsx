'use client'

import { T, FH } from '@/design/tokens'
import { Btn } from '@/components/Btn'
import { ModalOrSheet } from '@/components/modal'

/**
 * A solo group is a normal group, so anyone invited can see and edit what's
 * already in it. Shown before the first person joins a one-member group with
 * expenses: adding a member or guest, sharing the invite link, or a QR add.
 */
export function SoloInviteWarning({ open, groupName, expenseCount, onCancel, onContinue }: {
  open: boolean
  groupName: string
  expenseCount: number
  onCancel: () => void
  onContinue: () => void
}) {
  const past = expenseCount === 1 ? 'the 1 past expense' : `all ${expenseCount} past expenses`
  const message = `They’ll see ${past} and any budget, and they’ll be able to change them. To keep this private, start a new group with them instead.`
  return (
    <ModalOrSheet open={open} onClose={onCancel} title={`Invite someone to ${groupName}?`} maxWidth={440}>
      <div style={{ padding: '22px 22px 26px' }}>
        <h2 style={{ margin: 0, fontFamily: FH, fontSize: 21, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.2, color: T.ink }}>
          Invite someone to {groupName}?
        </h2>
        <p style={{ margin: '10px 0 18px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: T.inkMuted, textWrap: 'pretty' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
          <Btn variant="soft" size="md" onClick={onCancel} style={{ padding: '10px 16px' }}>Keep it private</Btn>
          <Btn variant="primary" size="md" onClick={onContinue} style={{ padding: '10px 16px' }}>Continue to invite</Btn>
        </div>
      </div>
    </ModalOrSheet>
  )
}
