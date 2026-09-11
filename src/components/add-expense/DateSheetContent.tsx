'use client'

import { format, parseISO } from 'date-fns'
import { Token } from '@/components/PersonToken'
import { CalendarGrid } from '@/components/CalendarGrid'
import { localISODate } from '@/lib/time'

interface Props {
  value: string
  onSelect: (value: string) => void
}

function isoToday(): string {
  return localISODate()
}
function isoYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localISODate(d)
}

/** Date picker sheet content: Today/Yesterday quick chips + the shared CalendarGrid. */
export function DateSheetContent({ value, onSelect }: Props) {
  const today = isoToday()
  const yesterday = isoYesterday()
  const selectedDate = value ? parseISO(value) : undefined

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Token selected={value === today} onClick={() => onSelect(today)}>Today</Token>
        <Token selected={value === yesterday} onClick={() => onSelect(yesterday)}>Yesterday</Token>
      </div>
      <CalendarGrid selected={selectedDate} onSelect={date => onSelect(format(date, 'yyyy-MM-dd'))} />
    </div>
  )
}
