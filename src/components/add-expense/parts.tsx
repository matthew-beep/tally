'use client'

import { T, FMONO } from '@/design/tokens'
import { displayName, firstName } from '@/lib/memberDisplay'
import type { GroupMember } from '@/types'

/** Compact row label — "You" for the current user, otherwise a first name. */
export function shortName(m: GroupMember | undefined, youMemberId?: string): string {
  if (!m) return '…'
  if (m.id === youMemberId) return 'You'
  return firstName(displayName(m))
}

/** Whole numbers stay clean ("5%"); fractional remainders keep one decimal. */
export function fmtPct(n: number): string {
  return Number.isInteger(Math.round(n * 10) / 10) ? n.toFixed(0) : n.toFixed(1)
}

/** Balanced/remaining pill — used by the mobile breakdown. */
export function RemainderCounter({ label, value, valid }: { label: string; value: string; valid: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 12,
      background: valid ? T.mintSoft : T.coralSoft,
      color: valid ? T.mintInk : T.coralInk,
      fontSize: 13, fontWeight: 600,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: valid ? T.mint : T.coral, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, flexShrink: 0,
      }}>{valid ? '✓' : '!'}</span>
      <div style={{ flex: 1 }}>{label}</div>
      <div style={{ fontFamily: FMONO, fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
  )
}

/** Balanced/remaining indicator — icon + label/value, no background or pill. Used at the top of the desktop split list. */
export function RemainderInline({ label, value, valid }: { label: string; value: string; valid: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      color: valid ? T.mintInk : T.coralInk,
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span>{valid ? '✓' : '!'}</span>
      <span>{label}</span>
      <span style={{ fontFamily: FMONO }}>{value}</span>
    </span>
  )
}

export function Hairline() {
  return <div style={{ height: 0.5, background: T.line, flexShrink: 0 }} />
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={13} height={13} viewBox="0 0 14 14" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
      <path d="M5 3l4 4-4 4" stroke={open ? T.sun : T.lineStrong} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Checkbox({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${on ? T.sun : T.lineStrong}`,
        background: on ? T.sun : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.14s',
        fontSize: 11, fontWeight: 800, color: T.sunInk,
      }}
    >{on ? '✓' : ''}</div>
  )
}
