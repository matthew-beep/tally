'use client'

import { useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { T, F, FH } from '@/design/tokens'

export type BtnVariant = 'primary' | 'dark' | 'outline' | 'danger' | 'dangerOutline' | 'soft'
export type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: BtnVariant
  size?: BtnSize
  fullWidth?: boolean
  icon?: ReactNode
  style?: CSSProperties
}

const SIZE: Record<BtnSize, CSSProperties> = {
  sm: { padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: T.r.pill, gap: 6 },
  md: { padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: T.r.md, gap: 8 },
  lg: { padding: '13px', fontSize: 14.5, fontWeight: 700, borderRadius: T.r.card, gap: 8 },
}

// Variants with a solid fill are "raised" tactile objects — they get depth
// shadow + press motion. Bordered/transparent variants (outline, dangerOutline)
// stay flat — that's already the right read for quiet/secondary actions.
const RAISED_VARIANTS: BtnVariant[] = ['primary', 'dark', 'soft', 'danger']

function variantStyle(variant: BtnVariant, disabled: boolean, hover: boolean, press: boolean): CSSProperties {
  switch (variant) {
    case 'primary':
      if (disabled) return { background: T.lineStrong, color: T.inkFaint, border: 0 }
      return {
        // Both states are gradients on purpose — a gradient can't interpolate to
        // a flat colour, so swapping to solid on press snaps instead of easing.
        // Pressed reverses the light: dark at the top, as if lit from above and
        // pushed in.
        background: press
          ? `linear-gradient(180deg, ${T.sunLo} 0%, ${T.sunLo} 55%, ${T.sun} 100%)`
          : `linear-gradient(180deg, ${T.sunHi} 0%, ${T.sun} 55%, ${T.sunLo} 100%)`,
        color: T.sunOn, border: 0,
        boxShadow: press ? T.shadowSunPressed : hover ? T.shadowSunHover : T.shadowSun,
      }
    case 'dark':
      if (disabled) return { background: T.lineStrong, color: T.inkFaint, border: 0 }
      return {
        background: T.ink, color: T.bg, border: 0,
        boxShadow: press ? T.shadowPressed : hover ? T.shadowRaisedHover : T.shadowRaised,
      }
    case 'outline':
      // Inset ring rather than a real border — matches the design's flat "hair"
      // tier and keeps the button's box the same size as a filled one, so
      // outline/filled pairs in a footer line up without compensating padding.
      return { background: 'transparent', color: T.inkMuted, border: 0, boxShadow: `inset 0 0 0 1.5px ${T.lineStrong}` }
    case 'danger':
      // Same neutral disabled treatment as primary/dark. A destructive button
      // gated behind a confirm should read as un-armed, not as a dimmed
      // version of itself.
      if (disabled) return { background: T.lineStrong, color: T.inkFaint, border: 0 }
      return {
        background: T.coral, color: '#fff', border: 0,
        // All three states carry the same layer count so the press eases.
        boxShadow: press
          ? `${T.shadowPressed}, 0 4px 16px ${T.coral}55`
          : hover ? `${T.shadowRaisedHover}, 0 4px 16px ${T.coral}55` : `${T.shadowRaised}, 0 4px 16px ${T.coral}55`,
      }
    case 'dangerOutline':
      return { background: 'transparent', color: T.coralInk, border: 0, boxShadow: `inset 0 0 0 1px ${T.coral}` }
    case 'soft':
      return {
        background: T.surfaceAlt, color: T.inkMuted, border: 0,
        boxShadow: press ? T.shadowPressed : hover ? T.shadowRaisedHover : T.shadowRaised,
      }
  }
}

// Shared CTA button — solid/outline/danger variants in sm/md/lg sizes.
// Not for icon-only circular buttons or unstyled clickable rows/links — those stay bespoke.
export function Btn({
  variant = 'primary', size = 'md', fullWidth, icon, disabled, children, style, ...rest
}: BtnProps) {
  const sizeStyle = SIZE[size]
  const raised = RAISED_VARIANTS.includes(variant) && !disabled
  const [hover, setHover] = useState(false)
  const [press, setPress] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerEnter={() => raised && setHover(true)}
      onPointerLeave={() => { setHover(false); setPress(false) }}
      onPointerDown={() => raised && setPress(true)}
      onPointerUp={() => setPress(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: size === 'sm' ? F : FH,
        cursor: disabled ? 'default' : 'pointer',
        transition: raised ? 'background .12s ease, color .12s ease, transform .09s ease, box-shadow .12s ease' : 'all 0.18s',
        transform: raised ? (press ? 'translateY(1px)' : hover ? 'translateY(-1px)' : 'none') : undefined,
        width: fullWidth ? '100%' : undefined,
        ...sizeStyle,
        ...variantStyle(variant, !!disabled, hover, press),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
