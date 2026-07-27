import type { CSSProperties, ReactNode } from 'react'
import { T } from '@/design/tokens'

interface SectionLabelProps {
  children: ReactNode
  /** default: 11px / 0.6 letter-spacing — section headers. sm: 10px / 0.7 — field captions. */
  size?: 'default' | 'sm'
  color?: string
  style?: CSSProperties
}

/** Uppercase, letter-spaced muted caption — section headers and form field labels. */
export function SectionLabel({ children, size = 'default', color = T.inkMuted, style }: SectionLabelProps) {
  const base: CSSProperties = size === 'sm'
    ? { fontSize: 10, letterSpacing: 0.7 }
    : { fontSize: 11, letterSpacing: 0.6 }
  return (
    <div style={{ ...base, fontWeight: 700, textTransform: 'uppercase', color, ...style }}>
      {children}
    </div>
  )
}
