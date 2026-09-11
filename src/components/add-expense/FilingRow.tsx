'use client'

import { useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { T, F, well } from '@/design/tokens'
import { AvatarStack } from '@/components/Avatar'
import { CATEGORIES } from '@/lib/categories'
import { avatarProfile } from '@/lib/memberDisplay'
import { AnchoredPopover } from './AnchoredPopover'
import { DateSheetContent } from './DateSheetContent'
import { dateLabel } from './parts'
import type { AddExpenseFormState } from './useAddExpenseForm'

const round = {
  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
} as const

const CHEVRON = (
  <svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke={T.inkFaint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M1 1l3.5 3.5L8 1" />
  </svg>
)

const ICON_DATE = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.2" y="2.8" width="13.6" height="12" rx="2.4" />
    <path d="M1.2 6.4h13.6M4.8 1.2v3M11.2 1.2v3" strokeLinecap="round" />
  </svg>
)

const ICON_CATEGORY = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={T.inkFaint} strokeWidth="1.5" strokeLinecap="round">
    <path d="M2.6 6.2l5.4-3.6 5.4 3.6v6.2a1 1 0 01-1 1H3.6a1 1 0 01-1-1V6.2z" />
  </svg>
)

/**
 * One pill in the filing row. Raised at rest, recessed with a sun rim while
 * its popover is open — the same two states as the sentence's tokens. Without
 * `onClick` it is a statement, not a control: no chevron, no pointer.
 */
function FilingChip({ open = false, onClick, lead, muted, chipRef, children }: {
  open?: boolean
  onClick?: () => void
  lead?: ReactNode
  muted?: boolean
  chipRef?: Ref<HTMLButtonElement>
  children: ReactNode
}) {
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, flexShrink: 0,
    padding: lead ? '6px 13px 6px 6px' : '6px 13px', borderRadius: T.r.pill,
    fontFamily: F, fontSize: 13.5, fontWeight: 700, color: muted ? T.inkFaint : T.ink,
    whiteSpace: 'nowrap',
    ...(open
      ? well(true)
      : { background: T.surface, boxShadow: T.shadowRaised, border: 0, transition: 'box-shadow .15s ease' }),
  } as const

  if (!onClick) return <span style={style}>{lead}{children}</span>

  return (
    <button ref={chipRef} type="button" onClick={onClick} aria-expanded={open} style={{ ...style, cursor: 'pointer' }}>
      {lead}{children}{CHEVRON}
    </button>
  )
}

/**
 * Group · date · category — the three filing questions, none of which are
 * about this charge's money, in one row above the fields that are. The group is
 * shown, not chosen: switching it would swap the member list under a half-filled
 * split. The faces on the right are who the expense lands on.
 */
export function FilingRow({ s }: { s: AddExpenseFormState }) {
  const [open, setOpen] = useState<'date' | 'category' | null>(null)
  const dateRef = useRef<HTMLButtonElement>(null)
  const catRef  = useRef<HTMLButtonElement>(null)
  const toggle = (p: 'date' | 'category') => setOpen(o => (o === p ? null : p))
  const close = () => setOpen(null)

  // Auto-detection falls back to 💸 when the description matches nothing, and
  // "Other" is a guess, not an answer — so until a keyword hits or the user
  // picks, the chip asks rather than asserting it.
  const hasCategory = s.manualCategory || s.category !== '💸'
  const chosen = CATEGORIES.find(c => c.emoji === s.category)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
      paddingBottom: 16, marginBottom: 18, borderBottom: `0.5px solid ${T.line}`,
    }}>
      <FilingChip lead={<span style={{ ...round, background: T.sun }}>{s.group?.emoji ?? '💸'}</span>}>
        {s.group?.name ?? '…'}
      </FilingChip>

      <FilingChip
        chipRef={dateRef} open={open === 'date'} onClick={() => toggle('date')}
        lead={<span style={{ ...round, color: T.inkMuted }}>{ICON_DATE}</span>}
      >{dateLabel(s.expenseDate)}</FilingChip>

      <FilingChip
        chipRef={catRef} open={open === 'category'} onClick={() => toggle('category')} muted={!hasCategory}
        lead={
          <span style={{ ...round, background: hasCategory ? T.sink : 'transparent', boxShadow: hasCategory ? T.shadowHair : 'none' }}>
            {hasCategory ? s.category : ICON_CATEGORY}
          </span>
        }
      >{hasCategory ? (chosen?.label ?? 'Other') : 'Category'}</FilingChip>

      <span style={{ marginLeft: 'auto' }}>
        <AvatarStack
          size={24} overlap={0.33} max={5} ringColor={T.bg}
          members={s.members.map(m => ({ profile: avatarProfile(m), slot: s.slotById[m.id] ?? 0, isYou: m.id === s.youMemberId }))}
        />
      </span>

      <AnchoredPopover open={open === 'date'} anchorRef={dateRef} onClose={close} width={300} label="Date">
        <div style={{ padding: 7 }}>
          <DateSheetContent value={s.expenseDate} onSelect={d => { s.setExpenseDate(d); close() }} />
        </div>
      </AnchoredPopover>

      <AnchoredPopover open={open === 'category'} anchorRef={catRef} onClose={close} width={232} label="Category">
        {CATEGORIES.map(cat => {
          const on = hasCategory && cat.emoji === s.category
          return (
            <button
              key={cat.emoji} type="button"
              onClick={() => { s.selectCategory(cat.emoji); close() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 42,
                padding: '9px 12px', borderRadius: T.r.md, cursor: 'pointer', textAlign: 'left',
                fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink,
                ...(on ? well() : { background: 'transparent', border: 0 }),
              }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{cat.emoji}</span>
              {cat.label}
            </button>
          )
        })}
      </AnchoredPopover>
    </div>
  )
}
