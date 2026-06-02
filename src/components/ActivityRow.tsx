'use client'

import { T, FMONO } from '@/design/tokens'
import type { ActivityItem } from '@/types'

export function ActivityRow({ item, showGroup = false }: {
  item: ActivityItem
  showGroup?: boolean
}) {
  if (item.type === 'expense') {
    const subtitle = showGroup
      ? `${item.payerName} · ${item.groupEmoji} ${item.groupName}`
      : `${item.payerName} · ${new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

    return (
      <div style={{ background: T.surface, borderRadius: T.r.md, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: T.shadowSm }}>
        <div style={{ width: 34, height: 34, borderRadius: T.r.sm, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
          {item.category ?? '💸'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}
          </div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: T.ink, flexShrink: 0 }}>
          ${item.amount.toFixed(2)}
        </div>
      </div>
    )
  }

  const confirmed = item.status === 'confirmed'
  return (
    <div style={{ background: confirmed ? T.mintSoft : T.surface, borderRadius: T.r.md, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: T.shadowSm }}>
      <div style={{ width: 34, height: 34, borderRadius: T.r.sm, background: confirmed ? T.mintSoft : T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {confirmed ? '✓' : '⏳'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: confirmed ? T.mintInk : T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.fromName} paid {item.toName}
        </div>
        {showGroup && (
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>
            {item.groupEmoji} {item.groupName}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: confirmed ? T.mintInk : T.ink, flexShrink: 0 }}>
        ${item.amount.toFixed(2)}
      </div>
    </div>
  )
}
