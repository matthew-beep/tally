'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type DayButtonProps, type ChevronProps } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { T, F, FH } from '@/design/tokens'
import { usePopoverPosition } from '@/lib/usePopoverPosition'

interface Props {
  /** 'yyyy-MM-dd', matches the native date input format used elsewhere. */
  value: string
  onChange: (value: string) => void
}

function DayButtonImpl({ day, modifiers, className, ...rest }: DayButtonProps) {
  const { selected, today, outside, disabled } = modifiers
  return (
    <button
      type="button"
      {...rest}
      style={{
        width: 34, height: 34, border: 0, cursor: disabled ? 'default' : 'pointer',
        borderRadius: T.r.pill, fontFamily: F, fontSize: 13, fontWeight: selected ? 700 : 500,
        background: selected ? T.sun : 'transparent',
        color: selected ? T.sunOn : disabled || outside ? T.inkFaint : T.ink,
        boxShadow: !selected && today ? `inset 0 0 0 1.5px ${T.sun}` : 'none',
        opacity: disabled ? 0.5 : 1,
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

/**
 * Desktop date picker: same trigger-button-plus-popover pattern as
 * EmojiPopover, with react-day-picker's day grid inside instead of an emoji
 * row. All calendar visuals are overridden inline via `styles`/`components`
 * so it matches T tokens rather than the library's default rdp.css look
 * (which isn't imported at all).
 */
export function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const { popRef, pos } = usePopoverPosition({ open, anchorRef, onClose: () => setOpen(false), align: 'start', preferBelow: true })

  const selectedDate = value ? parseISO(value) : undefined

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 10px', borderRadius: T.r.md, border: `1px solid ${T.line}`,
          background: T.bg, fontSize: 14, fontFamily: F, color: T.ink, cursor: 'pointer',
        }}
      >
        <CalendarDays size={15} color={T.inkMuted} />
        {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select date'}
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos?.top, bottom: pos?.bottom, left: pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden',
            zIndex: 400,
            background: T.surface, border: `0.5px solid ${T.line}`, borderRadius: T.r.lg,
            boxShadow: T.shadowFloat, padding: 12,
            animation: 'tally-fade 0.12s ease',
          }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={date => { if (date) { onChange(format(date, 'yyyy-MM-dd')); setOpen(false) } }}
            components={{ DayButton: DayButtonImpl, Chevron: ChevronImpl }}
            styles={{
              root: { margin: 0 },
              months: { position: 'relative' },
              month_caption: {
                display: 'flex', alignItems: 'center', height: 34,
                fontFamily: FH, fontSize: 14, fontWeight: 700, color: T.ink, padding: '0 64px 10px 4px',
              },
              weekday: { fontFamily: F, fontSize: 11, fontWeight: 600, color: T.inkFaint, textTransform: 'uppercase' },
              nav: { position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: 2, height: 34 },
              button_previous: { border: 0, background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: T.r.pill },
              button_next: { border: 0, background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: T.r.pill },
            }}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
