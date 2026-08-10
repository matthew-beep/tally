'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F } from '@/design/tokens'

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

const GAP = 8
const MARGIN = 8

/**
 * Desktop emoji picker: a compact row floating over its anchor.
 *
 * Portalled and positioned `fixed` rather than absolutely inside the anchor's
 * parent, because both places this mounts clip their overflow — the detail
 * drawer's ModalContent scrolls (`overflowY: auto`) and the feed's month card
 * is `overflow: hidden`. An absolutely-positioned popover would be sliced off
 * in both. Fixed coordinates from getBoundingClientRect sidestep the ancestor
 * chain entirely.
 *
 * Opens upward by default and flips below only when the anchor is too near the
 * top of the viewport; clamped horizontally so it never runs off either edge.
 */
export function EmojiPopover({
  open, emojis, selected = [], anchorRef, zIndex = 400, onClose, onPick,
}: Props) {
  const popRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Layout effect so the first paint is already in place — measuring in a
  // regular effect shows one frame at the origin before it snaps.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }

    function place() {
      const anchor = anchorRef.current
      const pop = popRef.current
      if (!anchor || !pop) return
      const a = anchor.getBoundingClientRect()
      const p = pop.getBoundingClientRect()

      const above = a.top - p.height - GAP
      const top = above >= MARGIN ? above : a.bottom + GAP
      const left = Math.min(
        Math.max(MARGIN, a.left + a.width / 2 - p.width / 2),
        window.innerWidth - p.width - MARGIN
      )
      setPos({ top, left })
    }

    place()
    // The anchor moves when anything behind the popover scrolls, so track it
    // on capture (scroll doesn't bubble from inner scrollers).
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Capture + stop: the detail drawer and desktop Modal both listen for
      // Escape on window, and one press should close only the popover.
      e.stopPropagation()
      onClose()
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (popRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return // let the button toggle itself
      onClose()
    }

    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [open, onClose, anchorRef])

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
        top: pos?.top ?? 0,
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
