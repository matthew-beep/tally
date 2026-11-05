'use client'

import { useCallback, useSyncExternalStore } from 'react'

interface SharedQuery {
  mq: MediaQueryList
  subscribers: Set<() => void>
  onChange: () => void
}

/**
 * One native listener per query, however many components ask. A feed renders an
 * emoji picker per row, and with a listener each, crossing a breakpoint ran a
 * separate React commit per row, enough to trip "Maximum update depth exceeded"
 * in a group with a few dozen expenses. Notifying everyone from one event
 * batches them into a single render.
 */
const shared = new Map<string, SharedQuery>()

function getShared(query: string): SharedQuery {
  let entry = shared.get(query)
  if (!entry) {
    const subscribers = new Set<() => void>()
    entry = {
      mq: window.matchMedia(query),
      subscribers,
      onChange: () => subscribers.forEach(notify => notify()),
    }
    shared.set(query, entry)
  }
  return entry
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const entry = getShared(query)
    if (entry.subscribers.size === 0) entry.mq.addEventListener('change', entry.onChange)
    entry.subscribers.add(notify)
    return () => {
      entry.subscribers.delete(notify)
      if (entry.subscribers.size === 0) entry.mq.removeEventListener('change', entry.onChange)
    }
  }, [query])

  // Correct from the first client render, so AddExpenseForm doesn't flash its
  // desktop modal on mobile. The server has no matchMedia, so hydration starts
  // from `false` and React corrects it before the browser paints.
  return useSyncExternalStore(
    subscribe,
    () => getShared(query).mq.matches,
    () => false,
  )
}

/** True when viewport is mobile sheet breakpoint (matches .modal-sheet-* CSS). */
export function useIsMobileSheet() {
  return useMediaQuery('(max-width: 767px)')
}
