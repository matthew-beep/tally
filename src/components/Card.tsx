'use client'

import { T } from '@/design/tokens'
import type { CSSProperties } from 'react'

interface CardProps {
  children: React.ReactNode
  style?: CSSProperties
  className?: string
  onClick?: () => void
  hoverable?: boolean
  /** `elevated` (default) is the prominent card-bg tier — stat blocks, empty states.
   *  `surface` is the flatter list-row tier — feed rows, inline sections. No border by default;
   *  pass `border` in `style` for the bordered surface rows used elsewhere. */
  tone?: 'elevated' | 'surface'
}

const TONE_BASE = {
  elevated: { background: T.cardBg, border: T.cardBorder, borderRadius: T.r.lg, boxShadow: T.cardShadow },
  surface:  { background: T.surface, border: 'none', borderRadius: T.r.md, boxShadow: T.shadowSm },
} as const

export function Card({ children, style, className, onClick, hoverable = false, tone = 'elevated' }: CardProps) {
  const actionable = !!(onClick || hoverable)
  return (
    <div
      className={actionable ? `card-affordance${className ? ` ${className}` : ''}` : className}
      onClick={onClick}
      style={{
        ...TONE_BASE[tone],
        cursor: actionable ? 'pointer' : undefined,
        transition: 'background 0.15s, box-shadow 0.15s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Trailing chevron for actionable cards — pairs with `.card-affordance`'s hover
 *  CSS (dashboard.css), which drives its resting/hover opacity. Consumer places
 *  it as the last child so it sits after whatever trailing content (amount,
 *  badge) the row has. */
export function CardChevron() {
  return (
    <svg className="card-chevron" width="7" height="12" viewBox="0 0 7 12" style={{ flexShrink: 0 }}>
      <path d="M1 1l5 5-5 5" fill="none" stroke={T.inkFaint} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
