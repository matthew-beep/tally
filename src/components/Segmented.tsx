'use client'

import type { CSSProperties } from 'react'
import { T, F } from '@/design/tokens'

export interface SegmentedOption<V extends string> {
  value: V
  label: string
}

interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[]
  value: V
  onChange: (v: V) => void
  fullWidth?: boolean
  style?: CSSProperties
}

// Tactile segmented control. The track is a RECESSED trough; the selected
// segment is a RAISED warm-white insert that lifts out of it. Deliberately not
// sun-filled — the sun accent is reserved for the one primary action per view,
// and a mode picker isn't it.
export function Segmented<V extends string>({
  options, value, onChange, fullWidth, style,
}: SegmentedProps<V>) {
  return (
    <div style={{
      display: fullWidth ? 'flex' : 'inline-flex',
      alignSelf: 'flex-start',
      gap: 3,
      padding: 4,
      borderRadius: T.r.card,
      background: T.sink,
      boxShadow: T.shadowRecessed,
      width: fullWidth ? '100%' : undefined,
      ...style,
    }}>
      {options.map(opt => {
        const on = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: fullWidth ? 1 : undefined,
              border: 0,
              cursor: 'pointer',
              padding: '8px 15px',
              borderRadius: 10,
              fontFamily: F,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: on ? T.surface : 'transparent',
              color: on ? T.ink : T.inkMuted,
              boxShadow: on ? T.shadowRaised : T.shadowNone,
              transition: 'background .14s ease, box-shadow .14s ease, color .14s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
