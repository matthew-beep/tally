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
  /** `sun` fills the selected segment with the accent. Only for a view with no primary action to compete with. */
  tone?: 'neutral' | 'sun'
  style?: CSSProperties
}

// Tactile segmented control. The track is a RECESSED trough; the selected
// segment is a RAISED warm-white insert that lifts out of it. Deliberately not
// sun-filled by default — the sun accent is reserved for the one primary action
// per view, and a mode picker usually isn't it. `tone="sun"` is the exception.
// Every state uses a gradient and a four-layer shadow so selecting eases.
export function Segmented<V extends string>({
  options, value, onChange, fullWidth, tone = 'neutral', style,
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
              background: !on
                ? 'linear-gradient(180deg, transparent 0%, transparent 100%)'
                : tone === 'sun'
                  ? `linear-gradient(180deg, ${T.sunHi} 0%, ${T.sun} 55%, ${T.sunLo} 100%)`
                  : `linear-gradient(180deg, ${T.surface} 0%, ${T.surface} 100%)`,
              color: !on ? T.inkMuted : tone === 'sun' ? T.sunOn : T.ink,
              boxShadow: !on ? T.shadowNone : tone === 'sun' ? T.shadowSun : T.shadowRaised,
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
