'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

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
