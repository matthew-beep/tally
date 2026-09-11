'use client'

// Two layouts over one state machine:
//   Desktop — a 560px dialog that states the split as a sentence, and widens
//             to 1010px to slide a split ledger in beside the form.
//   Mobile  — title + amount, the token sentence, then always-visible details.
// All state, validation and save logic lives in useAddExpenseForm; the panels
// are presentation only. See ./add-expense/.

import { useState } from 'react'
import { useAddExpenseForm } from '@/components/add-expense/useAddExpenseForm'
import { DesktopPanel } from '@/components/add-expense/DesktopPanel'
import { MobilePanel } from '@/components/add-expense/MobilePanel'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { useGroup } from '@/queries/useGroups'
import { ModalOrSheet } from '@/components/modal'

// The desktop dialog's two widths: the form alone, and the form with the
// split ledger beside it.
const DIALOG_WIDTH = 560
const DIALOG_WIDTH_WIDE = 1010

interface AddExpenseFormProps {
  groupId: string
  onSuccess: () => void
  onCancel: () => void
  /** Desktop only — reports whether the panel wants the wide dialog. */
  onWideChange?: (wide: boolean) => void
}

export function AddExpenseForm({ groupId, onSuccess, onCancel, onWideChange }: AddExpenseFormProps) {
  const isMobile = useIsMobileSheet()
  const state = useAddExpenseForm({ groupId, isMobile, onSuccess })

  return isMobile
    ? <MobilePanel s={state} onCancel={onCancel} />
    : <DesktopPanel s={state} onCancel={onCancel} onWideChange={onWideChange} />
}

interface AddExpenseSheetProps {
  open: boolean
  onClose: () => void
  groupId: string
}

export function AddExpenseSheet({ open, onClose, groupId }: AddExpenseSheetProps) {
  const { data: group } = useGroup(groupId)
  const title = group ? `Add expense — ${group.name}` : 'Add expense'
  // Owned here rather than in the panel because the modal's width is set out
  // here. The panel reports it, and resets it to narrow when it unmounts, so
  // the next open never starts wide.
  const [wide, setWide] = useState(false)

  return (
    <ModalOrSheet
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={wide ? DIALOG_WIDTH_WIDE : DIALOG_WIDTH}
      sheetContentClassName="add-expense-panel-root"
      sheetContentStyle={{ padding: 0, overflow: 'hidden' }}
      sheetRepositionInputs={false}
      panelClassName="add-expense-panel-root"
      panelStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <AddExpenseForm groupId={groupId} onSuccess={onClose} onCancel={onClose} onWideChange={setWide} />
    </ModalOrSheet>
  )
}
