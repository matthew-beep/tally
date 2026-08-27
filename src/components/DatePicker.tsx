'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { T, F } from '@/design/tokens'
import { usePopoverPosition } from '@/lib/usePopoverPosition'
import { CalendarGrid } from '@/components/CalendarGrid'

interface Props {
  /** 'yyyy-MM-dd', matches the native date input format used elsewhere. */
  value: string
  onChange: (value: string) => void
}

/**
 * Desktop date picker: same trigger-button-plus-popover pattern as
 * EmojiPopover, with CalendarGrid's day grid inside instead of an emoji row.
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
            background: T.surface, borderRadius: T.r.lg,
            boxShadow: T.shadowFloat, padding: 12,
            animation: 'tally-fade 0.12s ease',
          }}
        >
          <CalendarGrid
            selected={selectedDate}
            onSelect={date => { onChange(format(date, 'yyyy-MM-dd')); setOpen(false) }}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
