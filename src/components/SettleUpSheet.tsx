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
import { useGlobalBalances } from '@/queries/useGlobalBalances'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
  settleUser: string
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


// ── Root sheet ──────────────────────────────────────────────────────────
export function SettleUpSheet({ open, onClose, groupId, settleUser }: Props) {

  const { data: globalBalances } = useGlobalBalances()
  const [screen, setScreen]           = useState<Screen>('list')
  const [activeTransfer, setActiveTransfer] = useState<DebtTransfer | null>(null)
  const [amount, setAmount]           = useState('')
  const [note, setNote]               = useState('')
  const [method, setMethod]           = useState<string | null>(null)

  console.log(globalBalances)
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


  return (
    <ModalOrSheet open={open} onClose={handleClose} title="Settle up" maxWidth={460}>
      <ModalContent>
        <div>
          <h1>Settle up</h1>
        </div>
      </ModalContent>
    </ModalOrSheet>
  )
}
