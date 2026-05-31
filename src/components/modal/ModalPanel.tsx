'use client'

import { T } from '@/design/tokens'
import type { CSSProperties, ReactNode } from 'react'

/** Surface card that wraps header / content / footer inside ModalMenu */
interface ModalPanelProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export function ModalPanel({ children, style, className }: ModalPanelProps) {
  return (
    <div
      className={className}
      style={{
        background: T.surface,
        borderRadius: T.r.panel,
        boxShadow: T.shadowModal,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'min(90dvh, 720px)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
