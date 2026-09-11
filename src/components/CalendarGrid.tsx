'use client'

import { DayPicker, type DayButtonProps, type ChevronProps } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { T, F, FH } from '@/design/tokens'

function DayButtonImpl({ day, modifiers, ...rest }: DayButtonProps) {
  const { selected, today, outside, disabled } = modifiers
  return (
    <button
      type="button"
      {...rest}
      style={{
        width: '100%', aspectRatio: '1', maxWidth: 40, maxHeight: 40,
        border: 0, cursor: disabled ? 'default' : 'pointer',
        borderRadius: T.r.pill, fontFamily: F, fontSize: 13, fontWeight: selected ? 700 : 500,
        background: selected ? T.sun : 'transparent',
        color: selected ? T.sunOn : disabled || outside ? T.inkFaint : T.ink,
        boxShadow: !selected && today ? `inset 0 0 0 1.5px ${T.sun}` : 'none',
        opacity: disabled ? 0.5 : 1,
        margin: '0 auto', display: 'block',
      }}
    >
      {day.date.getDate()}
    </button>
  )
}

function ChevronImpl({ orientation }: ChevronProps) {
  const Icon = orientation === 'right' ? ChevronRight : ChevronLeft
  return <Icon size={16} color={T.inkMuted} />
}

interface Props {
  selected: Date | undefined
  onSelect: (date: Date) => void
}

/**
 * The tactile day-grid — react-day-picker styled entirely via T tokens
 * (rdp.css is never imported). Shared by DatePicker's popover (desktop) and
 * DateSheetContent's sheet (mobile); each owns its own surrounding chrome.
 */
export function CalendarGrid({ selected, onSelect }: Props) {
  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={date => { if (date) onSelect(date) }}
      components={{ DayButton: DayButtonImpl, Chevron: ChevronImpl }}
      styles={{
        root: { margin: 0 },
        months: { position: 'relative' },
        month: { display: 'flex', flexDirection: 'column', width: '100%' },
        month_caption: {
          display: 'flex', alignItems: 'center', justifyContent: 'center', height: 34,
          fontFamily: FH, fontSize: 14, fontWeight: 700, color: T.ink, padding: '0 0 10px',
        },
        month_grid: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' },
        weekday: {
          fontFamily: F, fontSize: 11, fontWeight: 600, color: T.inkFaint,
          textTransform: 'uppercase', textAlign: 'center', width: '14.28%',
        },
        day: { textAlign: 'center', width: '14.28%', padding: '2px 0' },
        nav: {
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 34, pointerEvents: 'none',
        },
        button_previous: {
          border: 0, background: 'transparent', cursor: 'pointer',
          padding: 6, borderRadius: T.r.pill, pointerEvents: 'auto',
        },
        button_next: {
          border: 0, background: 'transparent', cursor: 'pointer',
          padding: 6, borderRadius: T.r.pill, pointerEvents: 'auto',
        },
      }}
    />
  )
}
