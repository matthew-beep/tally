'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { Modal } from './Modal'
import { Sheet } from './Sheet'

interface ModalOrSheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name for the mobile sheet (visually hidden). */
  title: string
  children: ReactNode
  /** Desktop centered modal width (px) */
  maxWidth?: number
  /** Applied to Vaul drawer content on mobile */
  sheetContentClassName?: string
  sheetContentStyle?: CSSProperties
  /** Applied to Modal panel on desktop */
  panelClassName?: string
  panelStyle?: CSSProperties
}

/**
 * Mobile (≤767px): Vaul bottom sheet with drag-to-dismiss.
 * Desktop: existing centered Modal.
 */
export function ModalOrSheet({
  open,
  onClose,
  title,
  children,
  maxWidth = 440,
  sheetContentClassName,
  sheetContentStyle,
  panelClassName,
  panelStyle,
}: ModalOrSheetProps) {
  const isMobile = useIsMobileSheet()

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={title}
        contentClassName={sheetContentClassName}
        contentStyle={sheetContentStyle}
      >
        {children}
      </Sheet>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      panelClassName={panelClassName}
      panelStyle={panelStyle}
    >
      {children}
    </Modal>
  )
}
