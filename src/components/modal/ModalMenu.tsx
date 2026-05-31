'use client'

import type { CSSProperties, ReactNode } from 'react'

const Z_MENU = 301

interface ModalMenuProps {
  children: ReactNode
  maxWidth?: number
  style?: CSSProperties
  className?: string
  /** Stop clicks inside the panel from reaching the overlay */
  onPanelClick?: (e: React.MouseEvent) => void
}

export function ModalMenu({
  children,
  maxWidth = 440,
  style,
  className,
  onPanelClick,
}: ModalMenuProps) {
  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_MENU,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        pointerEvents: 'none',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => {
          e.stopPropagation()
          onPanelClick?.(e)
        }}
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth,
          animation: 'modal-pop-in 0.22s ease-out',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  )
}
