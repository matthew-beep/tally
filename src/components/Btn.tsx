'use client'

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { T, F, FH } from '@/design/tokens'

export type BtnVariant = 'primary' | 'dark' | 'outline' | 'danger' | 'dangerOutline' | 'soft'
export type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: BtnVariant
  size?: BtnSize
  fullWidth?: boolean
  icon?: ReactNode
  style?: CSSProperties
}

const SIZE: Record<BtnSize, CSSProperties> = {
  sm: { padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: T.r.pill, gap: 6 },
  md: { padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: T.r.md, gap: 8 },
  lg: { padding: '13px', fontSize: 14.5, fontWeight: 700, borderRadius: T.r.card, gap: 8 },
}

function variantStyle(variant: BtnVariant, disabled: boolean): CSSProperties {
  switch (variant) {
    case 'primary':
      return disabled
        ? { background: T.lineStrong, color: T.inkFaint, border: 0 }
        : { background: T.sun, color: T.sunOn, border: 0 }
    case 'dark':
      return disabled
        ? { background: T.lineStrong, color: T.inkFaint, border: 0 }
        : { background: T.ink, color: T.bg, border: 0 }
    case 'outline':
      return { background: 'transparent', color: T.inkMuted, border: `1.5px solid ${T.lineStrong}` }
    case 'danger':
      return disabled
        ? { background: T.coral, color: '#fff', border: 0, opacity: 0.6 }
        : { background: T.coral, color: '#fff', border: 0, boxShadow: `0 4px 16px ${T.coral}55` }
    case 'dangerOutline':
      return { background: 'transparent', color: T.coralInk, border: 0, boxShadow: `inset 0 0 0 1px ${T.coral}` }
    case 'soft':
      return { background: T.surfaceAlt, color: T.inkMuted, border: 0 }
  }
}

// Shared CTA button — solid/outline/danger variants in sm/md/lg sizes.
// Not for icon-only circular buttons or unstyled clickable rows/links — those stay bespoke.
export function Btn({
  variant = 'primary', size = 'md', fullWidth, icon, disabled, children, style, ...rest
}: BtnProps) {
  const sizeStyle = SIZE[size]
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: size === 'sm' ? F : FH,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.18s',
        width: fullWidth ? '100%' : undefined,
        ...sizeStyle,
        ...variantStyle(variant, !!disabled),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
