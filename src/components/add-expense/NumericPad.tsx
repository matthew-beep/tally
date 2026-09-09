'use client'

import { useState } from 'react'
import { T, FH } from '@/design/tokens'
import { Btn } from '@/components/Btn'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

/**
 * Append one keystroke to a money string.
 *
 * Caps at two decimals rather than letting a third through: `round2` at save
 * time would round it away silently, so a typed 12.345 would land as 12.35 with
 * no sign that the app changed the number. Refusing the keystroke says so at the
 * moment it happens.
 */
export function pressKey(value: string, k: string): string {
  if (k === 'del') return value.slice(0, -1)
  if (k === '.') return value.includes('.') ? value : (value === '' ? '0.' : value + '.')
  if (value === '0') return k
  const [, decimals] = value.split('.')
  if (decimals !== undefined && decimals.length >= 2) return value
  return (value + k).replace(/^\./, '0.')
}

function Key({ k, onPress }: { k: string; onPress: (k: string) => void }) {
  const [down, setDown] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onPress(k)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      aria-label={k === 'del' ? 'Delete' : k}
      style={{
        minHeight: 52, borderRadius: T.r.card, border: 0, cursor: 'pointer',
        fontFamily: FH, fontSize: 24, fontWeight: 600, color: T.ink,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: down ? T.sink : T.surface,
        boxShadow: down ? T.shadowRecessed : T.shadowRaised,
        transform: down ? 'translateY(1px)' : 'none',
        transition: 'transform .07s ease, box-shadow .07s ease',
      }}
    >
      {k === 'del' ? (
        <svg width="22" height="16" viewBox="0 0 24 18" fill="none" stroke={T.inkMuted} strokeWidth="1.8" strokeLinecap="round">
          <path d="M8 1.5h13a2 2 0 012 2v11a2 2 0 01-2 2H8L1 9z" />
          <path d="M12.5 6.5l6 5M18.5 6.5l-6 5" />
        </svg>
      ) : k}
    </button>
  )
}

/**
 * The amount's input surface. Deliberately not the OS keyboard: a software
 * keyboard on iOS doesn't shrink 100dvh, which is what forced the Save button
 * to scroll with the body instead of pinning. With the pad owning the amount,
 * the bottom of the screen is ours and the commit button can hold still.
 */
export function NumericPad({ value, onChange, onAction, actionLabel, actionOn }: {
  value: string
  onChange: (v: string) => void
  onAction: () => void
  actionLabel: string
  actionOn: boolean
}) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9,
      padding: '10px 14px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
        {KEYS.map(k => <Key key={k} k={k} onPress={x => onChange(pressKey(value, x))} />)}
      </div>
      <Btn
        onClick={onAction} disabled={!actionOn} variant="primary" size="lg" fullWidth
        style={{ borderRadius: 15, padding: '15px', fontSize: 17, fontFamily: FH, letterSpacing: -0.2 }}
      >{actionLabel}</Btn>
    </div>
  )
}
