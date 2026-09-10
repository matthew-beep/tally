'use client'

import { useEffect, useState } from 'react'

/**
 * How many CSS pixels the on-screen keyboard covers at the bottom of the layout
 * viewport — 0 when no keyboard is up.
 *
 * iOS Safari does not shrink `100dvh` for the software keyboard, it overlays
 * it, so a full-height flex column has no way to know that its bottom edge is
 * hidden. `visualViewport` is the one thing that does: its height is the part
 * of the page the user can actually see. Feeding this back in as the panel's
 * bottom padding is what lets the add-expense form behave the same way under
 * the system keyboard that it used to under the custom keypad — the difference
 * being that now nothing has to be built to get it.
 *
 * Returns 0 on the server, on browsers without the API, and on desktop, where
 * the layout is already correct.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const read = () => {
      // offsetTop is non-zero while the browser holds the visual viewport
      // scrolled to keep the caret in view. Without it the inset reads short by
      // exactly that scroll and anything pinned to it drifts down over the keys.
      const next = window.innerHeight - (vv.height + vv.offsetTop)
      // Under this it is browser chrome settling, not a keyboard — treating a
      // 40px toolbar as one would leave a gap the user reads as a bug.
      setInset(next > 90 ? Math.round(next) : 0)
    }

    read()
    vv.addEventListener('resize', read)
    vv.addEventListener('scroll', read)
    return () => {
      vv.removeEventListener('resize', read)
      vv.removeEventListener('scroll', read)
    }
  }, [])

  return inset
}
