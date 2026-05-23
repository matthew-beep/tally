'use client'

import { T } from '@/design/tokens'
import type { CSSProperties, ReactNode } from 'react'

interface ModalFooterProps {
  children: ReactNode
  style?: CSSProperties
}

export function ModalFooter({ children, style }: ModalFooterProps) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: '16px 24px 20px',
        borderTop: `1px solid ${T.line}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
