'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  // Resolve synchronously on the client so the first paint is already correct.
  // Defaulting to `false` made every consumer render its desktop branch for one
  // frame on mobile — most visibly AddExpenseForm, which flashed the two-column
  // modal before swapping to the sheet. Guarded for SSR, where there's no
  // matchMedia and `false` is the only answer available.
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    function onChange(e: MediaQueryListEvent) {
      setMatches(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True when viewport is mobile sheet breakpoint (matches .modal-sheet-* CSS). */
export function useIsMobileSheet() {
  return useMediaQuery('(max-width: 767px)')
}
