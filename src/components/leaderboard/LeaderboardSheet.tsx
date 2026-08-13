'use client'

import { T, FH } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { ModalOrSheet, ModalContent } from '@/components/modal'
import { formatAmount } from '@/lib/money'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import type { LeaderboardEntry } from '@/lib/leaderboard'
import type { GroupMember } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  entries: LeaderboardEntry[]
  members: GroupMember[]
  myId?: string
}

/**
 * "Who fronted the most" — ranked bars scaled to the top spender.
 * Gross fronted, not net standing: this is not a balance and must never be
 * captioned like one. The members ledger covers who owes what.
 */
export function LeaderboardSheet({ open, onClose, entries, members, myId }: Props) {
  const total = entries.reduce((s, e) => s + e.paid, 0)
  const max   = entries[0]?.paid ?? 0
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))

  return (
    <ModalOrSheet open={open} onClose={onClose} title="Who's ahead?" maxWidth={420}>
      <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14 }}>
          <span style={{ width: 44, height: 44, borderRadius: T.r.md, background: T.sunSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏆</span>
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>Who&rsquo;s ahead?</div>
            <div style={{ fontSize: 12.5, color: T.inkMuted, marginTop: 1 }}>Who&rsquo;s fronted the most so far</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </ModalContent>
    </ModalOrSheet>
  )
}
