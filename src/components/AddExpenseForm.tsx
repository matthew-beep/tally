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
import type { Expense } from '@/types'

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
  /** Open pre-filled to edit this expense instead of adding a new one. */
  expense?: Expense
}

export function AddExpenseForm({ groupId, onSuccess, onCancel, onWideChange, expense }: AddExpenseFormProps) {
  const isMobile = useIsMobileSheet()
  const state = useAddExpenseForm({ groupId, onSuccess, initial: expense })

  return isMobile
    ? <MobilePanel s={state} onCancel={onCancel} />
    : <DesktopPanel s={state} onCancel={onCancel} onWideChange={onWideChange} />
}

interface AddExpenseSheetProps {
  open: boolean
  onClose: () => void
  groupId: string
  /** Edit this expense — the same form, pre-filled, saving over the original. */
  expense?: Expense | null
}

export function AddExpenseSheet({ open, onClose, groupId, expense }: AddExpenseSheetProps) {
  const { data: group } = useGroup(groupId)
  const verb  = expense ? 'Edit expense' : 'Add expense'
  const title = group ? `${verb} — ${group.name}` : verb
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
      {/* Keyed so each expense (or a fresh add) mounts its own seed. */}
      <AddExpenseForm
        key={expense?.id ?? 'new'}
        groupId={groupId} expense={expense ?? undefined}
        onSuccess={onClose} onCancel={onClose} onWideChange={setWide}
      />
    </ModalOrSheet>
  )
}
