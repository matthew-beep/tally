'use client'

import { T } from '@/design/tokens'
import type { CSSProperties, ReactNode } from 'react'

interface ModalContentProps {
  children: ReactNode
  style?: CSSProperties
}

export function ModalContent({ children, style }: ModalContentProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '20px 24px',
        color: T.ink,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
