'use client'

import { useState } from 'react'
import type { InputHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { T, F, FH, well } from '@/design/tokens'

export type InputSize = 'hero' | 'title' | 'md' | 'cellLg' | 'cell'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'style' | 'prefix'> {
  size?: InputSize
  /** Leading affix, e.g. '$'. Rendered as a sun tile on `hero`, muted text elsewhere. */
  prefix?: ReactNode
  /** Trailing affix, e.g. '%'. */
  suffix?: ReactNode
  fullWidth?: boolean
  /** Right-align the value — the default for numeric cells. */
  alignRight?: boolean
  /** Width of the text field itself. Cells size to content rather than stretching. */
  fieldWidth?: number | string
  /** Applied to the well, not the <input>. */
  style?: CSSProperties
  /** Applied to the <input> — needed for `.add-expense-amount-input` (iOS zoom guard). */
  inputClassName?: string
}

const SIZE: Record<InputSize, {
  padding: string; fontSize: number; fontFamily: string; fontWeight: number
  letterSpacing: number; radius: number; gap: number; affix: number
}> = {
  hero:  { padding: '14px 16px', fontSize: 38, fontFamily: FH, fontWeight: 800, letterSpacing: -1.5, radius: 16, gap: 12, affix: 22 },
  title: { padding: '12px 14px', fontSize: 21, fontFamily: F,  fontWeight: 700, letterSpacing: -0.5, radius: 14, gap: 8,  affix: 16 },
  md:    { padding: '11px 14px', fontSize: 15, fontFamily: F,  fontWeight: 600, letterSpacing: 0,    radius: 12, gap: 6,  affix: 13 },
  cellLg:{ padding: '8px 12px',  fontSize: 19, fontFamily: FH, fontWeight: 600, letterSpacing: -0.4, radius: 10, gap: 2,  affix: 14 },
  cell:  { padding: '6px 10px',  fontSize: 14, fontFamily: F,  fontWeight: 700, letterSpacing: 0,    radius: 10, gap: 2,  affix: 12 },
}

/**
 * The app's text input — a RECESSED well you drop a value into, with the sun
 * focus rim replacing a native outline.
 *
 * Sizes: `hero` (the amount), `title` (expense description), `md` (standard
 * field), `cell` (compact numeric in a split row).
 *
 * For inputs whose well contains more than a value — MemberCombobox's chips,
 * HandleInput's validation pip — compose `well()` directly instead; this
 * component deliberately doesn't try to model those.
 */
export function Input({
  size = 'md', prefix, suffix, fullWidth, alignRight, fieldWidth,
  style, inputClassName, disabled, ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const s = SIZE[size]

  // The hero's $ is a small raised sun tile, per the design's TxWell prefix.
  const prefixNode = size === 'hero'
    ? (
      <span style={{
        width: 40, height: 40, flexShrink: 0, borderRadius: 12,
        background: T.sun, color: T.sunOn,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FH, fontSize: s.affix, fontWeight: 700,
        boxShadow: T.shadowSun,
      }}>{prefix}</span>
    )
    : <span style={{ fontSize: s.affix, color: T.inkMuted, fontFamily: FH, flexShrink: 0 }}>{prefix}</span>

  return (
    <div style={{
      display: alignRight && !fullWidth ? 'inline-flex' : 'flex',
      alignItems: 'center',
      gap: s.gap,
      padding: s.padding,
      borderRadius: s.radius,
      width: fullWidth ? '100%' : undefined,
      opacity: disabled ? 0.45 : 1,
      ...well(focused),
      ...style,
    }}>
      {prefix != null && prefixNode}
      <input
        {...rest}
        disabled={disabled}
        className={inputClassName}
        onFocus={e => { setFocused(true); rest.onFocus?.(e) }}
        onBlur={e => { setFocused(false); rest.onBlur?.(e) }}
        style={{
          flex: fieldWidth == null ? 1 : undefined,
          width: fieldWidth,
          minWidth: 0,
          border: 'none', outline: 'none', background: 'transparent',
          fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
          letterSpacing: s.letterSpacing,
          color: T.ink, caretColor: T.sun,
          textAlign: alignRight ? 'right' : 'left',
          padding: 0,
        }}
      />
      {suffix != null && (
        <span style={{ fontSize: s.affix, color: T.inkMuted, flexShrink: 0 }}>{suffix}</span>
      )}
    </div>
  )
}
