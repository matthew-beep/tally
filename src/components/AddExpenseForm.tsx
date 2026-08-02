'use client'

// Two layouts over one state machine:
//   Desktop — two-column modal (mode tabs + split list right, tiles left).
//   Mobile  — title + amount, two collapsible rows (Paid by, Split), then
//             always-visible Expense Details.
// All state, validation and save logic lives in useAddExpenseForm; the panels
// are presentation only. See ./add-expense/.

import { useAddExpenseForm } from '@/components/add-expense/useAddExpenseForm'
import { DesktopPanel } from '@/components/add-expense/DesktopPanel'
import { MobilePanel } from '@/components/add-expense/MobilePanel'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { useGroup } from '@/queries/useGroups'
import { ModalOrSheet } from '@/components/modal'

interface AddExpenseFormProps {
  groupId: string
  onSuccess: () => void
  onCancel: () => void
}

export function AddExpenseForm({ groupId, onSuccess, onCancel }: AddExpenseFormProps) {
  const isMobile = useIsMobileSheet()
  const state = useAddExpenseForm({ groupId, isMobile, onSuccess })

  return isMobile
    ? <MobilePanel s={state} onCancel={onCancel} />
    : <DesktopPanel s={state} onCancel={onCancel} />
}

interface AddExpenseSheetProps {
  open: boolean
  onClose: () => void
  groupId: string
}

export function AddExpenseSheet({ open, onClose, groupId }: AddExpenseSheetProps) {
  const { data: group } = useGroup(groupId)
  const title = group ? `Add expense — ${group.name}` : 'Add expense'

  return (
    <ModalOrSheet
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={740}
      sheetContentClassName="add-expense-panel-root"
      sheetContentStyle={{ padding: 0, overflow: 'hidden' }}
      panelClassName="add-expense-panel-root"
      panelStyle={{ padding: 0, overflow: 'hidden' }}
    >
      <AddExpenseForm groupId={groupId} onSuccess={onClose} onCancel={onClose} />
    </ModalOrSheet>
  )
}
