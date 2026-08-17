'use client'

import { useState } from 'react'
import { DatePicker } from '@/components/DatePicker'
import { T } from '@/design/tokens'

// Scratch-only route to visually verify DatePicker in a browser without
// needing an authenticated session. Delete before committing.
export default function PreviewPage() {
  const [date, setDate] = useState('2026-08-15')
  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: 60 }}>
      <div style={{ maxWidth: 280 }}>
        <DatePicker value={date} onChange={setDate} />
      </div>
      <p style={{ marginTop: 20, color: T.ink }}>value: {date}</p>
    </div>
  )
}
