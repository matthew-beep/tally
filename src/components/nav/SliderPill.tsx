'use client'

import { T } from '@/design/tokens'
import { NAV_SLIDE } from './constants'
import type { SliderBox } from './useSlider'

export type SliderVariant = 'pill' | 'float'

function pillGeom(variant: SliderVariant, box: SliderBox) {
  if (variant === 'float') {
    return {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      borderRadius: 999,
      background: T.sun,
    }
  }
  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    borderRadius: 12,
    background: T.sunSoft,
  }
}

interface Props {
  variant: SliderVariant
  box: SliderBox | null
  glow?: string
}

export function SliderPill({ variant, box, glow }: Props) {
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
        boxShadow: glow && g ? `0 6px 18px ${glow}` : 'none',
        transition: `transform ${NAV_SLIDE}, background .2s ease`,
      }}
    />
  )
}
