'use client'

import { T, FMONO } from '@/design/tokens'
import { EmojiTile } from '@/components/EmojiTile'
import { formatAmount } from '@/lib/money'
import type { ActivityItem } from '@/types'

export function ActivityRow({ item, showGroup = false }: {
  item: ActivityItem
  showGroup?: boolean
}) {
  if (item.type === 'expense') {
    const subtitle = showGroup
      ? `${item.payerName} · ${item.groupEmoji} ${item.groupName}`
      : `${item.payerName} · ${new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    const edited = item.updatedAt && item.updatedAt !== item.createdAt

    return (
      <div style={{ background: T.surface, borderRadius: T.r.md, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: T.shadowSm }}>
        <EmojiTile emoji={item.category ?? '💸'} size={34} fontSize={17} radius={T.r.sm} background={T.bg} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}{edited && <span style={{ fontSize: 10.5, color: T.inkFaint, marginLeft: 5 }}>(edited)</span>}
          </div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: T.ink, flexShrink: 0 }}>
          {formatAmount(item.amount)}
        </div>
      </div>
    )
  }

  // quiet ledger treatment — settlement card reads the same as an expense
  // card (no tinted background); a small mono "settled"/"pending" tag in
  // the caption line does the signaling instead.
  const confirmed = item.status === 'confirmed'
  return (
    <div style={{ background: T.surface, borderRadius: T.r.md, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: T.shadowSm }}>
      <div style={{ width: 34, height: 34, borderRadius: T.r.sm, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: confirmed ? T.mintInk : T.inkMuted, flexShrink: 0 }}>
        {confirmed ? (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M8 5v3.2l2.2 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.fromName} paid {item.toName}
        </div>
        <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: FMONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: confirmed ? T.mintInk : T.inkMuted, background: confirmed ? T.mintSoft : T.surfaceAlt, padding: '1px 6px', borderRadius: 4 }}>
            {confirmed ? 'settled' : 'pending'}
          </span>
          {showGroup && <span>{item.groupEmoji} {item.groupName}</span>}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: confirmed ? T.mintInk : T.ink, flexShrink: 0 }}>
        {formatAmount(item.amount)}
      </div>
    </div>
  )
}
