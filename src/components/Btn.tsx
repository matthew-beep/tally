'use client'

import { T, F } from '@/design/tokens'
import type { CSSProperties, ButtonHTMLAttributes } from 'react'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  style?: CSSProperties
}

const variants = {
  primary:   { bg: T.ink,      color: T.bg,       border: 'none' },
  secondary: { bg: T.surface,  color: T.ink,       border: `1.5px solid ${T.lineStrong}` },
  ghost:     { bg: 'transparent', color: T.inkMuted, border: 'none' },
  danger:    { bg: T.coralSoft, color: T.coralInk, border: `1.5px solid rgba(239,97,68,0.3)` },
}

const sizeStyles = {
  sm: { padding: '7px 14px', fontSize: 13, borderRadius: T.r.md },
  md: { padding: '11px 20px', fontSize: 14, borderRadius: T.r.md },
  lg: { padding: '14px 24px', fontSize: 16, borderRadius: T.r.lg },
}

export function Btn({ variant = 'primary', size = 'md', fullWidth, style, children, ...rest }: BtnProps) {
  const v = variants[variant]
  const s = sizeStyles[size]

  return (
    <button
      style={{
        fontFamily: F,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : undefined,
        background: v.bg,
        color: v.color,
        border: v.border,
        ...s,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
