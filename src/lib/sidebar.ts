'use client'

import { useState, useEffect } from 'react'

const KEY = 'tally-sidebar'

/**
 * Desktop sidebar rail toggle.
 *
 * Mirrors `useTheme` deliberately: the collapsed state lives as a
 * `data-sidebar` attribute on <html>, set before first paint by the inline
 * script in `app/layout.tsx`, and the *width is driven entirely by CSS*
 * (`.dashboard-sidebar` rules in `styles/dashboard.css`).
 *
 * React must not own the width. If the collapsed flag were only read in an
 * effect, every page load would paint the sidebar expanded and then snap it to
 * the rail on hydration — the same flash the theme toggle exists to avoid.
 */
export function useSidebarRail() {
  const [rail, setRail] = useState(false)

  useEffect(() => {
    setRail(document.documentElement.getAttribute('data-sidebar') === 'rail')
  }, [])

  function apply(next: boolean) {
    setRail(next)
    if (next) document.documentElement.setAttribute('data-sidebar', 'rail')
    else document.documentElement.removeAttribute('data-sidebar')
    try { localStorage.setItem(KEY, next ? 'rail' : 'full') } catch {}
  }

  function toggle() { apply(!rail) }

  // ⌘\ / Ctrl+\ — the convention for this in editors and chat apps.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        apply(document.documentElement.getAttribute('data-sidebar') !== 'rail')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { rail, toggle }
}
