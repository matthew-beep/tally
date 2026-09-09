'use client'

import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { T, F } from '@/design/tokens'
import { CATEGORIES } from '@/lib/categories'
import type { OpenPanel } from './types'
import type { AddExpenseFormState } from './useAddExpenseForm'

function UtilityButton({ panel, label, icon, s }: {
  panel: Exclude<OpenPanel, null>; label: string; icon: ReactNode; s: AddExpenseFormState
}) {
  const open = s.openPanel === panel
  return (
    <button
      type="button" onClick={() => s.setOpenPanel(panel)}
      style={{
        flex: 1, minWidth: 0, minHeight: 40, borderRadius: T.r.md, border: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        background: 'transparent', cursor: 'pointer', fontFamily: F,
        fontSize: 12.5, fontWeight: 700, color: open ? T.sun : T.inkMuted,
        transition: 'color .14s ease',
      }}
    >
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

/**
 * The quiet strip above the input slab: the three things about an expense that
 * aren't the split. These were a "Details" section of labelled rows taking a
 * third of the screen; as a single row they cost one line and leave the body
 * free for the fields and the sentence.
 *
 * Itemize is deliberately absent — it's a split mode, reached from the split
 * sheet's tabs on both mobile and desktop, rather than a fourth utility action
 * that only one of the two surfaces would have.
 */
export function UtilityRow({ s }: { s: AddExpenseFormState }) {
  const categoryLabel = CATEGORIES.find(c => c.emoji === s.category)?.label ?? 'Other'

  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
      padding: '9px 14px', borderTop: `0.5px solid ${T.line}`,
    }}>
      <UtilityButton
        panel="date" s={s} label={format(parseISO(s.expenseDate), 'MMM d')}
        icon={
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <rect x="1.2" y="2.8" width="13.6" height="12" rx="2.4" />
            <path d="M1.2 6.4h13.6M4.8 1.2v3M11.2 1.2v3" strokeLinecap="round" />
          </svg>
        }
      />
      <UtilityButton
        panel="category" s={s} label={categoryLabel}
        icon={<span style={{ fontSize: 14, flexShrink: 0 }}>{s.category}</span>}
      />
      <UtilityButton
        panel="note" s={s} label={s.note ? 'Note added' : 'Note'}
        icon={
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
          </svg>
        }
      />
    </div>
  )
}
