'use client'

import { createPortal } from 'react-dom'
import { T, F } from '@/design/tokens'
import { usePopoverPosition } from '@/lib/usePopoverPosition'

interface Props {
  open: boolean
  emojis: readonly string[]
  selected?: readonly string[]
  /** The element to sit above (or below, if there's no room). */
  anchorRef: React.RefObject<HTMLElement | null>
  zIndex?: number
  onClose: () => void
  onPick: (emoji: string) => void
}

/**
 * Desktop emoji picker: a compact row floating over its anchor.
 * Positioning + escape/outside-click dismissal is shared with
 * ProfileMenuPopover via usePopoverPosition.
 */
export function EmojiPopover({
  open, emojis, selected = [], anchorRef, zIndex = 400, onClose, onPick,
}: Props) {
  const { popRef, pos } = usePopoverPosition({ open, anchorRef, onClose, align: 'center', gap: 8 })

  if (!open) return null

  return createPortal(
    <div
      ref={popRef}
      role="menu"
      // React propagates portal events up the React tree, not the DOM tree —
      // so without this, picking an emoji bubbles into whatever rendered
      // ReactionPills. In the feed that is the card's onClick, and choosing a
      // reaction would also open the expense detail sheet.
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos?.top,
        bottom: pos?.bottom,
        left: pos?.left ?? 0,
        // Hidden for the measuring pass so it never flashes at the origin.
        visibility: pos ? 'visible' : 'hidden',
        zIndex,
        display: 'flex',
        gap: 3,
        background: T.surface,
        border: `0.5px solid ${T.line}`,
        borderRadius: T.r.pill,
        boxShadow: T.shadowFloat,
        padding: '6px 9px',
        animation: 'tally-fade 0.12s ease',
      }}
    >
      {emojis.map(e => {
        const on = selected.includes(e)
        return (
          <button
            key={e}
            role="menuitemcheckbox"
            aria-checked={on}
            onClick={() => { onPick(e); onClose() }}
            style={{
              border: 0,
              background: on ? T.sunSoft : 'transparent',
              boxShadow: on ? `inset 0 0 0 1.5px ${T.sun}` : 'none',
              borderRadius: T.r.pill,
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: '4px 5px',
              fontFamily: F,
            }}
          >
            {e}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
