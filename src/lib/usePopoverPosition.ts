import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Opts {
  open: boolean
  /** The element the popover sits above (or below, if there's no room). */
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  /** Horizontal placement relative to the anchor. Default 'center'. */
  align?: 'start' | 'center'
  /** Gap between the popover and the anchor's edge. Default 8. */
  gap?: number
  /** Minimum distance from the viewport edge. Default 8. */
  margin?: number
  /** Match the popover's minimum width to the anchor's width. */
  matchAnchorWidth?: boolean
  /** Open below the anchor by default, flipping above only if there's no room. Default false (opens above). */
  preferBelow?: boolean
}

interface Pos {
  top?: number
  bottom?: number
  left: number
  width?: number
}

/**
 * Shared positioning + dismissal logic for portalled popovers (EmojiPopover,
 * ProfileMenuPopover). Portalled and positioned `fixed` off the anchor's
 * getBoundingClientRect rather than absolutely inside its parent, because
 * anchors here sit inside overflow-clipping containers (scrollable drawers,
 * `overflow: hidden` cards) that would slice off an absolutely-positioned
 * popover. Fixed coordinates sidestep the ancestor chain entirely.
 *
 * Opens upward by default and flips below only when the anchor is too near
 * the top of the viewport (reversed when `preferBelow` is set). Placement is pinned to the anchor's edge with
 * top/bottom (not a precomputed height offset), so the popover grows away
 * from the anchor and can't end up overlapping it if content height changes
 * after the initial measurement — see ProfileMenuPopover's git history for
 * the bug this sidesteps (a scale-transform animation on the measured
 * element caused getBoundingClientRect to under-report its resting height).
 */
export function usePopoverPosition({
  open, anchorRef, onClose, align = 'center', gap = 8, margin = 8, matchAnchorWidth = false, preferBelow = false,
}: Opts) {
  const popRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<Pos | null>(null)

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

      const fitsAbove = a.top - p.height - gap >= margin
      const fitsBelow = a.bottom + p.height + gap <= window.innerHeight - margin
      const openAbove = preferBelow ? !fitsBelow && fitsAbove : fitsAbove
      const left = align === 'center'
        ? Math.min(
            Math.max(margin, a.left + a.width / 2 - p.width / 2),
            window.innerWidth - p.width - margin
          )
        : Math.min(Math.max(margin, a.left), window.innerWidth - p.width - margin)
      const width = matchAnchorWidth ? a.width : undefined

      setPos(openAbove
        ? { bottom: window.innerHeight - a.top + gap, left, width }
        : { top: a.bottom + gap, left, width })
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
  }, [open, anchorRef, align, gap, margin, matchAnchorWidth, preferBelow])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Capture + stop: hosts like the detail drawer and desktop Modal also
      // listen for Escape on window, and one press should close only this.
      e.stopPropagation()
      onClose()
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (popRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return // let the anchor button toggle itself
      onClose()
    }

    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [open, onClose, anchorRef])

  return { popRef, pos }
}
