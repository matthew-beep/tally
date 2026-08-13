'use client'

import { Avatar } from '@/components/Avatar'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import { shortDate } from '@/lib/feedCards'
import { T, FH } from '@/design/tokens'
import type { NotificationBatch } from '@/types'

interface Props {
  batch: NotificationBatch
  last?: boolean
  onClick: () => void
}

// Glance-only rail row — no action buttons. Confirm/Deny/Join/Decline live in
// the notification center (NotificationsSheet); this just previews and links
// there. Structure matches the design's FNAttnRow: a sun attention dot (the
// only yellow — carries the signal instead of a tinted row), bold name line,
// reason line, context line, trailing chevron. Two things the design assumes
// that this app's schema doesn't have — a group name/emoji on a settlement's
// context line, and a payment "method" — are deliberately skipped rather than
// faked (see plan kind-stirring-popcorn, "Rail fidelity gap", resolved 2026-08-13).
export function AttentionPreviewRow({ batch, last = false, onClick }: Props) {
  const isInvite = batch.type === 'group_invite'
  const s = batch.settlements[0]
  const group = batch.notifications[0]?.group
  const fromMember = s?.from_member

  // Top line is the group name for invites (no inviter identity available —
  // notifications carries no invited_by field, see plan's resolved decision),
  // so the reason line below it stays generic rather than repeating the name.
  const reason = isInvite ? 'You’ve been invited' : 'Says they paid you'
  const context = isInvite
    ? batch.notifications[0]
      ? new Date(batch.notifications[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : undefined
    : batch.settlements.length > 1
      ? `Across ${batch.settlements.length} groups`
      : s
        ? shortDate(s.settled_date)
        : undefined

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 11,
        padding: '13px 15px 13px 22px',
        borderBottom: last ? 0 : `0.5px solid ${T.line}`,
        cursor: 'pointer',
      }}
    >
      {/* attention dot — the only yellow */}
      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: 999, background: T.sun }} />

      {isInvite ? (
        <div style={{ width: 38, height: 38, borderRadius: T.r.md, background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
          {group?.emoji ?? '👋'}
        </div>
      ) : (
        <Avatar profile={fromMember ? avatarProfile(fromMember) : undefined} size={38} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isInvite ? (group?.name ?? 'Group invite') : (fromMember ? displayName(fromMember) : '…')}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: T.ink, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reason}
        </div>
        {context && (
          <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {context}
          </div>
        )}
        
      </div>
      {!isInvite && (
            <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: T.mintInk, marginLeft: 'auto', flexShrink: 0 }}>
              {formatAmount(batch.amount)}
            </span>
          )}
      <svg width="7" height="12" viewBox="0 0 7 12" style={{ flexShrink: 0, marginLeft: 2 }}>
        <path d="M1 1l5 5-5 5" fill="none" stroke={T.inkFaint} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
