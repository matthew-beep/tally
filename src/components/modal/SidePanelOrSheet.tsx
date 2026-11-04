'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { T } from '@/design/tokens'
import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { ModalContext } from './ModalContext'
import { ModalOverlay } from './ModalOverlay'
import { Sheet } from './Sheet'
import { useBodyScrollLock } from './useBodyScrollLock'

interface Props {
  open: boolean
  onClose: () => void
  /** Accessible name for the panel. */
  title: string
  children: ReactNode
  /** Desktop panel width (px). */
  width?: number
}

/**
 * Mobile (≤767px): tall Vaul bottom sheet.
 * Desktop: a panel sliding in from the right, for content worth reading beside
 * the page it came from. Children lay out their own header, scroller and footer.
 */
export function SidePanelOrSheet({ open, onClose, title, children, width = 480 }: Props) {
  const isMobile = useIsMobileSheet()

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={title}
        contentStyle={{ height: '90dvh', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </Sheet>
    )
  }

  return <SidePanel open={open} onClose={onClose} title={title} width={width}>{children}</SidePanel>
}

function SidePanel({ open, onClose, title, children, width }: Required<Omit<Props, 'children'>> & { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [render, setRender] = useState(open)
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])
  useBodyScrollLock(render)

  useEffect(() => {
    if (open) {
      setClosing(false)
      setRender(true)
    } else if (render) {
      setClosing(true)
    }
  }, [open, render])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Focus moves into the panel on open and back to whatever opened it on close.
  useEffect(() => {
    if (open && mounted) {
      returnFocusTo.current = document.activeElement as HTMLElement | null
      panelRef.current?.focus()
    } else if (!open) {
      returnFocusTo.current?.focus()
      returnFocusTo.current = null
    }
  }, [open, mounted])

  if (!render || !mounted) return null

  return createPortal(
    <ModalContext.Provider value={{ onClose }}>
      <ModalOverlay onClick={onClose} closing={closing} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onAnimationEnd={e => {
          if (closing && e.target === e.currentTarget) setRender(false)
        }}
        style={{
          position: 'fixed',
          top: 8,
          right: 8,
          bottom: 8,
          zIndex: 301,
          width: `min(${width}px, calc(100% - 16px))`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          borderRadius: T.r.xl,
          background: T.surface,
          boxShadow: T.shadowFloat,
          animation: closing
            ? 'side-panel-out 0.2s ease-in forwards'
            : 'side-panel-in 0.28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {children}
      </div>
    </ModalContext.Provider>,
    document.body,
  )
}
