'use client'

import { T, F } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { avatarProfile } from '@/lib/memberDisplay'
import { shortName } from '@/components/add-expense/parts'
import type { GroupMember } from '@/types'

interface Props {
  members: GroupMember[]
  slotById: Record<string, 0 | 1 | 2 | 3>
  paidById: string | null
  onSelect: (id: string) => void
  youMemberId?: string
}

/** Vertical member list for the "Paid by" picker sheet — avatar, name, a checkmark on the selected row. */
export function PayerSheetContent({ members, slotById, paidById, onSelect, youMemberId }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {members.map((m, i) => {
        const selected = m.id === paidById
        return (
          <button
            key={m.id} type="button" onClick={() => onSelect(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '13px 2px',
              background: 'transparent', border: 0,
              borderBottom: i < members.length - 1 ? `0.5px solid ${T.line}` : 'none',
              cursor: 'pointer', font: 'inherit', textAlign: 'left', width: '100%',
            }}
          >
            <Avatar profile={avatarProfile(m)} slot={slotById[m.id] ?? 0} size={32} isYou={m.id === youMemberId} />
            <span style={{ flex: 1, fontFamily: F, fontSize: 15, fontWeight: selected ? 700 : 600, color: T.ink }}>
              {shortName(m, youMemberId)}
            </span>
            {selected && (
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l4 4 6-6" stroke={T.sun} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
