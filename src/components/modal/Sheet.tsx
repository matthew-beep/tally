'use client'

import { Drawer } from 'vaul'
import type { CSSProperties, ReactNode } from 'react'
import { T } from '@/design/tokens'

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Required for screen readers (visually hidden). */
  title: string
  children: ReactNode
  /** Only allow dragging via the handle — avoids fighting inner scroll. Default true. */
  handleOnly?: boolean
  contentClassName?: string
  contentStyle?: CSSProperties
  /**
   * Vaul's own keyboard handling: it translates the whole sheet up so the
   * focused input clears the keys. Turn it off for a sheet that already knows
   * about the keyboard itself (add expense reads `visualViewport` and pads its
   * scroller) — otherwise both act and the sheet's bottom edge lifts twice.
   * Default true, which is Vaul's default.
   */
  repositionInputs?: boolean
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  handleOnly = true,
  contentClassName,
  contentStyle,
  repositionInputs = true,
}: SheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={next => { if (!next) onClose() }}
      shouldScaleBackground={false}
      handleOnly={handleOnly}
      repositionInputs={repositionInputs}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay className="tally-sheet-overlay" />
        <Drawer.Content
          className={['tally-sheet-content', contentClassName].filter(Boolean).join(' ')}
          style={{
            background: T.surface,
            ...contentStyle,
          }}
        >
          <Drawer.Title className="tally-visually-hidden">{title}</Drawer.Title>
          <Drawer.Handle className="tally-sheet-handle" />
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
