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
  closing?: boolean
  onAnimationEnd?: (e: React.AnimationEvent<HTMLDivElement>) => void
}

export function ModalMenu({
  children,
  maxWidth = 440,
  style,
  className,
  onPanelClick,
  closing = false,
  onAnimationEnd,
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
        onAnimationEnd={onAnimationEnd}
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth,
          animation: closing ? 'modal-pop-out 0.16s ease-in forwards' : 'modal-pop-in 0.22s ease-out',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  )
}
