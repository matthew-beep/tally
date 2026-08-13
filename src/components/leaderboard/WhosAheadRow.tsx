'use client'

import { T, F } from '@/design/tokens'
import { displayName, firstName } from '@/lib/memberDisplay'
import type { LeaderboardEntry } from '@/lib/leaderboard'
import type { GroupMember } from '@/types'

interface Props {
  entries: LeaderboardEntry[]
  members: GroupMember[]
  myId?: string
  onOpen: () => void
  className?: string
}

/**
 * Slim discovery row — the leaderboard is a curiosity, not the reason you
 * opened the group, so it gets one line rather than an inline card. Tapping
 * it opens the full ranked-bars breakdown in LeaderboardSheet.
 */
export function WhosAheadRow({ entries, members, myId, onOpen, className }: Props) {
  const total = entries.reduce((s, e) => s + e.paid, 0)
  if (total < 0.01) return null

  const leader   = entries[0]
  const isYou    = leader.memberId === myId
  const m        = members.find(x => x.id === leader.memberId)
  const leaderName = isYou ? 'You' : m ? firstName(displayName(m)) : '…'

  return (
    <button
      className={className}
      onClick={onOpen}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: T.surface, border: `0.5px solid ${T.line}`, boxShadow: T.shadowSm, borderRadius: T.r.lg, padding: '12px 15px', cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left' }}
    >
      <span style={{ width: 34, height: 34, borderRadius: T.r.md, background: T.sunSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🏆</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Who&rsquo;s ahead?</div>
        <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>{leaderName} is fronting the most</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M5 3l4 4-4 4" stroke={T.inkFaint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
