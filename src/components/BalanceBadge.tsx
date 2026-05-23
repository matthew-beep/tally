'use client'

import { T, FMONO } from '@/design/tokens'

interface BalanceBadgeProps {
  amount: number
}

export function BalanceBadge({ amount }: BalanceBadgeProps) {
  if (Math.abs(amount) < 0.01) {
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '3px 9px',
          borderRadius: T.r.pill,
          background: T.line,
          color: T.inkMuted,
        }}
      >
        settled
      </span>
    )
  }

  const pos = amount > 0
  const abs = Math.abs(amount)
  const whole = Math.floor(abs)
  const cents = String(Math.round((abs - whole) * 100)).padStart(2, '0')

  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: T.r.pill,
        background: pos ? T.mintSoft : T.coralSoft,
        color: pos ? T.mintInk : T.coralInk,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0,
      }}
    >
      {pos ? '+$' : '−$'}
      {whole.toLocaleString()}
      <span style={{ fontFamily: FMONO, fontSize: 11 }}>.{cents}</span>
    </span>
  )
}
