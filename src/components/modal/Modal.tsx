'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ModalContext } from './ModalContext'
import { ModalOverlay } from './ModalOverlay'
import { ModalMenu } from './ModalMenu'
import { ModalPanel } from './ModalPanel'
import { ModalHeader } from './ModalHeader'
import { ModalContent } from './ModalContent'
import { ModalFooter } from './ModalFooter'
import { useBodyScrollLock } from './useBodyScrollLock'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Max width of the centered panel (px) */
  maxWidth?: number
  /** Clicking the dimmed backdrop calls onClose */
  closeOnOverlayClick?: boolean
  /** Full-screen on mobile, centered card on desktop */
  sheet?: boolean
  panelClassName?: string
  panelStyle?: CSSProperties
}

function ModalRoot({
  open,
  onClose,
  children,
  maxWidth = 440,
  closeOnOverlayClick = true,
  sheet = false,
  panelClassName,
  panelStyle,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <ModalContext.Provider value={{ onClose }}>
      <ModalOverlay onClick={closeOnOverlayClick ? onClose : undefined} />
      <ModalMenu maxWidth={maxWidth} className={sheet ? 'modal-sheet-menu' : undefined}>
        <ModalPanel
          className={[sheet ? 'modal-sheet-panel' : undefined, panelClassName].filter(Boolean).join(' ') || undefined}
          style={panelStyle}
        >
          {children}
        </ModalPanel>
      </ModalMenu>
    </ModalContext.Provider>,
    document.body,
  )
}

export const Modal = Object.assign(ModalRoot, {
  Overlay: ModalOverlay,
  Menu: ModalMenu,
  Panel: ModalPanel,
  Header: ModalHeader,
  Content: ModalContent,
  Footer: ModalFooter,
})
