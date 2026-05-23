'use client'

import { T, FH, FMONO } from '@/design/tokens'

interface AmountDisplayProps {
  amount: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showSign?: boolean
  color?: string
}

const sizes = {
  sm: { sign: 14, whole: 20, cents: 12 },
  md: { sign: 18, whole: 32, cents: 14 },
  lg: { sign: 24, whole: 48, cents: 18 },
  xl: { sign: 28, whole: 64, cents: 20 },
}

export function AmountDisplay({ amount, size = 'md', showSign = true, color }: AmountDisplayProps) {
  const pos = amount >= 0
  const abs = Math.abs(amount)
  const whole = Math.floor(abs)
  const cents = String(Math.round((abs - whole) * 100)).padStart(2, '0')
  const s = sizes[size]

  const resolvedColor = color ?? (pos ? T.mintInk : T.coralInk)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
      {showSign && (
        <span style={{ fontFamily: FH, fontSize: s.sign, fontWeight: 600, color: resolvedColor, opacity: 0.6 }}>
          {pos ? '+$' : '−$'}
        </span>
      )}
      {!showSign && (
        <span style={{ fontFamily: FH, fontSize: s.sign, fontWeight: 600, color: resolvedColor, opacity: 0.6 }}>
          $
        </span>
      )}
      <span style={{ fontFamily: FH, fontSize: s.whole, fontWeight: 700, color: resolvedColor, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
        {whole.toLocaleString()}
      </span>
      <span style={{ fontFamily: FMONO, fontSize: s.cents, fontWeight: 500, color: T.inkMuted }}>
        .{cents}
      </span>
    </span>
  )
}
