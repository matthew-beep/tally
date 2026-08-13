'use client'

import { T } from '@/design/tokens'
import { AttentionPreviewRow } from './AttentionPreviewRow'
import type { NotificationBatch } from '@/types'

interface Props {
  batches: NotificationBatch[]
  onSelect: (batch: NotificationBatch) => void
}

/** Bordered card of AttentionPreviewRows — shared by the home rail's capped
 * preview and the notification center's full list, so the two can't drift
 * in styling or `last`-row logic. */
export function AttentionList({ batches, onSelect }: Props) {
  return (
    <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: `inset 0 0 0 0.5px ${T.line}` }}>
      {batches.map((b, i) => (
        <AttentionPreviewRow key={b.key} batch={b} last={i === batches.length - 1} onClick={() => onSelect(b)} />
      ))}
    </div>
  )
}
