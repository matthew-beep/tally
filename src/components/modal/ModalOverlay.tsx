'use client'

import type { CSSProperties, MouseEventHandler } from 'react'

const Z_OVERLAY = 300

interface ModalOverlayProps {
  onClick?: MouseEventHandler<HTMLDivElement>
  style?: CSSProperties
}

export function ModalOverlay({ onClick, style }: ModalOverlayProps) {
  return (
    <div
      role="presentation"
      aria-hidden
      onClick={onClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_OVERLAY,
        background: 'rgba(15, 12, 8, 0.22)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'modal-fade-in 0.2s ease-out',
        ...style,
      }}
    />
  )
}
