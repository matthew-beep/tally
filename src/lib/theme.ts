'use client'

import { useState, useEffect } from 'react'

const KEY = 'tally-theme'

export function useTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem(KEY, 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem(KEY, 'light')
    }
  }

  return { isDark, toggle }
}
