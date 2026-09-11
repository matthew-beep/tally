'use client'

import { createPortal } from 'react-dom'
import type { ReactNode, RefObject } from 'react'
import { T } from '@/design/tokens'
import { usePopoverPosition } from '@/lib/usePopoverPosition'

/**
 * A small panel that drops from whatever opened it — the desktop dialog's date,
 * category and payer pickers. Portalled and fixed-positioned (via
 * usePopoverPosition) rather than absolute inside the dialog, because the
 * dialog body scrolls and would clip it. Sits above the modal's z-index (301).
 */
export function AnchoredPopover({ open, anchorRef, onClose, width, label, children }: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  width: number
  label: string
  children: ReactNode
}) {
  const { popRef, pos } = usePopoverPosition({ open, anchorRef, onClose, align: 'start', preferBelow: true })

  if (!open) return null

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={label}
      style={{
        position: 'fixed',
        top: pos?.top,
        bottom: pos?.bottom,
        left: pos?.left ?? 0,
        // Hidden for the measuring pass so it never flashes at the origin.
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 400,
        width,
        padding: 7,
        borderRadius: T.r.tab,
        background: T.surface,
        boxShadow: T.shadowFloat,
        animation: 'tally-fade 0.12s ease',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
