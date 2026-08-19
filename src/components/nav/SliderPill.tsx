'use client'

import { T } from '@/design/tokens'
import { NAV_SLIDE } from './constants'
import type { SliderBox } from './useSlider'

export type SliderVariant = 'pill' | 'float'

// The active nav item is the one RAISED sun object in the bar — same gradient
// and shadow recipe as a primary Btn, so "selected" reads as an object sitting
// on the surface rather than a flat colour fill.
const SUN_FILL = `linear-gradient(180deg, ${T.sunHi} 0%, ${T.sun} 55%, ${T.sunLo} 100%)`

function pillGeom(variant: SliderVariant, box: SliderBox) {
  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    borderRadius: variant === 'float' ? 999 : 10,
    background: SUN_FILL,
  }
}

interface Props {
  variant: SliderVariant
  box: SliderBox | null
}

export function SliderPill({ variant, box }: Props) {
  const g = box ? pillGeom(variant, box) : null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        opacity: g ? 1 : 0,
        width: g?.width ?? 0,
        height: g?.height ?? 0,
        borderRadius: g?.borderRadius ?? 0,
        background: g?.background ?? 'transparent',
        transform: g ? `translate(${g.left}px, ${g.top}px)` : 'none',
        boxShadow: g ? T.shadowSun : 'none',
        transition: `transform ${NAV_SLIDE}, background .2s ease`,
      }}
    />
  )
}
