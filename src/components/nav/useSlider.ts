'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type SliderBox = { left: number; top: number; width: number; height: number }

/** Measures the active item and returns a pill box relative to the container. */
export function useSlider(active: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const activeRef = useRef(active)
  activeRef.current = active
  const [box, setBox] = useState<SliderBox | null>(null)

  const measure = useCallback(() => {
    const c = containerRef.current
    const el = itemRefs.current[activeRef.current]
    if (!c || !el) return
    if (el.offsetWidth < 1 || el.offsetHeight < 1) return
    setBox({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    })
  }, [])

  useLayoutEffect(() => { measure() }, [active, measure])

  useEffect(() => {
    measure()
    const raf = requestAnimationFrame(measure)
    const c = containerRef.current
    let ro: ResizeObserver | undefined
    if (c && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure())
      ro.observe(c)
    }
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const setRef = (id: string) => (el: HTMLElement | null) => {
    itemRefs.current[id] = el
  }

  return { containerRef, setRef, box }
}
