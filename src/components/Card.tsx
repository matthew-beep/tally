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
        background: T.cardBg,
        border: T.cardBorder,
        borderRadius: T.r.lg,
        boxShadow: T.cardShadow,
        cursor: onClick || hoverable ? 'pointer' : undefined,
        transition: 'background 0.15s, box-shadow 0.15s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
