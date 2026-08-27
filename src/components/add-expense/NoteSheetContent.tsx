'use client'

import { useState } from 'react'
import { T, F, well } from '@/design/tokens'

interface Props {
  value: string
  onChange: (value: string) => void
}

/** Textarea composed with well() directly — Input.tsx's own guidance for inputs that aren't a plain value field. */
export function NoteSheetContent({ value, onChange }: Props) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ borderRadius: T.r.lg, ...well(focused) }}>
      <textarea
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Add a note the group will see…"
        rows={4}
        style={{
          width: '100%', border: 0, outline: 'none', background: 'transparent', resize: 'none',
          fontFamily: F, fontSize: 15, lineHeight: 1.5, color: T.ink, padding: '12px 14px',
        }}
      />
    </div>
  )
}
