'use client'

import { useState } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { formatAmount } from '@/lib/money'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import type { LeaderboardEntry } from '@/lib/leaderboard'
import type { GroupMember } from '@/types'

interface Props {
  entries: LeaderboardEntry[]
  members: GroupMember[]
  myId?: string
  defaultOpen?: boolean
}

/**
 * "Who fronted the most" — ranked bars scaled to the top spender.
 *
 * Gross fronted, not net standing: this is not a balance and must never be
 * captioned like one. The members ledger covers who owes what.
 *
 * Collapsed by default — it's a curiosity, not the reason you opened the group.
 */
export function GroupLeaderboard({ entries, members, myId, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const total = entries.reduce((s, e) => s + e.paid, 0)
  // Nobody has fronted anything — there's no ranking to show.
  if (total < 0.01) return null

  const max = entries[0]?.paid ?? 0
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))

  return (
    <div style={{ marginBottom: 20, background: T.surface, border: `0.5px solid ${T.line}`, boxShadow: T.shadowSm, borderRadius: T.r.lg, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 0, cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left' }}
      >
        <span style={{ fontSize: 17, lineHeight: 1 }}>🏆</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>Leaderboard</div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 1 }}>Who fronted the most</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}>
          <path d="M5 3l4 4-4 4" stroke={T.inkMuted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '2px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map((entry, i) => {
            const m     = memberById[entry.memberId]
            const isYou = entry.memberId === myId
            const name  = isYou ? 'You' : m ? firstName(displayName(m)) : '…'
            const pct   = max > 0 ? (entry.paid / max) * 100 : 0

            return (
              <div key={entry.memberId}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ width: 16, flexShrink: 0, fontFamily: FH, fontSize: 13, fontWeight: 700, color: T.inkFaint }}>{i + 1}</span>
                  <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, entry.memberId)} size={26} isYou={isYou} />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{name}</span>
                    {entry.txns > 0 && (
                      <span style={{ fontSize: 11.5, color: T.inkFaint, fontWeight: 500 }}>
                        {' · '}{entry.txns} {entry.txns === 1 ? 'expense' : 'expenses'}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.ink, flexShrink: 0 }}>
                    {formatAmount(entry.paid)}
                  </span>
                </div>
                <div style={{ height: 10, marginLeft: 26, borderRadius: T.r.pill, background: T.surfaceAlt, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: T.r.pill, background: i === 0 ? T.sun : isYou ? T.mint : T.lineStrong, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )
          })}

          <div style={{ marginTop: 4, textAlign: 'center', fontSize: 12, color: T.inkFaint }}>
            {formatAmount(total)} spent across the group
          </div>
        </div>
      )}
    </div>
  )
}
