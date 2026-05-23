'use client'

import { T } from '@/design/tokens'
import type { CSSProperties } from 'react'

interface CardProps {
  children: React.ReactNode
  style?: CSSProperties
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, style, onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        borderRadius: T.r.lg,
        boxShadow: T.shadow,
        cursor: onClick || hoverable ? 'pointer' : undefined,
        transition: 'background 0.1s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
