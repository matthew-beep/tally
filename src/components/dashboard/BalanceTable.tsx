'use client'

import { T, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { formatAmount } from '@/lib/money'
import type { Profile } from '@/types'

// Two-column money ledger. Rows/columns carry no notion of "owed to you" vs
// "you owe" — they just render whatever `amount` (and its sign) they're
// given. Direction lives entirely in how the caller buckets rows into
// `left`/`right` and picks each column's `accent`/`sign`.

export interface BalanceRow {
  id: string
  avatar: Pick<Profile, 'name' | 'display_name' | 'avatar_url'>
  slot: 0 | 1 | 2 | 3
  label: string
  amount: number
  breakdown?: { key: string; label: string; amount: number }[]
  onAvatarClick?: () => void
  onClick?: () => void
}

export interface BalanceColumn {
  title: string
  accent: string
  sum: number
  sign: '+' | '−'
  rows: BalanceRow[]
  emptyLabel?: string
}

interface BalanceTableProps {
  left: BalanceColumn
  right: BalanceColumn
}

export function BalanceTable({ left, right }: BalanceTableProps) {
  return (
    <div className="balance-table">
      <BalanceTableColumn column={left} />
      <div className="balance-table-divider" />
      <BalanceTableColumn column={right} />
    </div>
  )
}

function BalanceTableColumn({ column }: { column: BalanceColumn }) {
  const { title, accent, sum, sign, rows, emptyLabel = 'Nobody right now.' } = column

  return (
    <div className="balance-table-col">
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '0 4px 8px', borderBottom: `0.5px solid ${T.line}`, marginBottom: 2, flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          {title}
          {rows.length > 0 && (
            <span style={{ fontFamily: FMONO, fontSize: 9.5, fontWeight: 600, color: T.inkFaint, background: T.surfaceAlt, padding: '1px 5px', borderRadius: 999 }}>
              {rows.length}
            </span>
          )}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
          {sign}${sum.toFixed(0)}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: T.inkFaint, padding: '11px 4px' }}>{emptyLabel}</div>
      ) : (
        <div className="balance-table-col-list">
          {rows.map((row, i) => (
            <div key={row.id} style={{ borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
              <BalanceTableRow row={row} accent={accent} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BalanceTableRow({ row, accent }: { row: BalanceRow; accent: string }) {
  const { avatar, slot, label, amount, breakdown, onAvatarClick, onClick } = row
  const whole = Math.floor(Math.abs(amount)).toLocaleString()
  const sign = amount >= 0 ? '+' : '−'

  return (
    <div onClick={onClick} style={{ display: 'flex', gap: 11, padding: '11px 4px', cursor: onClick ? 'pointer' : 'default' }}>
      <div
        onClick={onAvatarClick ? e => { e.stopPropagation(); onAvatarClick() } : undefined}
        style={{ flexShrink: 0, cursor: onAvatarClick ? 'pointer' : 'default' }}
      >
        <Avatar profile={avatar} slot={slot} size={30} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {sign}${whole}
          </span>
        </div>
        {breakdown && breakdown.length > 0 && (
          <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {breakdown.map(part => (
              <div key={part.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: T.inkFaint }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{part.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatAmount(part.amount, { sign: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
