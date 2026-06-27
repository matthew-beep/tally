'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'
import { useDeleteExpense } from '@/queries/useExpenses'
import type { Expense, GroupMember, Profile } from '@/types'

interface Props {
  expense: Expense | null
  members: GroupMember[]
  groupId: string
  onClose: () => void
}

function slotFor(members: { id: string }[], id: string): 0 | 1 | 2 | 3 {
  const idx = members.findIndex(m => m.id === id)
  return Math.max(0, idx) % 4 as 0 | 1 | 2 | 3
}

export function ExpenseActionSheet({ expense, members, groupId, onClose }: Props) {
  const deleteExpense = useDeleteExpense(groupId)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useBodyScrollLock(!!expense)

  useEffect(() => {
    if (!expense) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expense, onClose])

  if (!expense || !mounted) return null

  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const payer     = memberById[expense.paid_by]
  const payerP    = payer?.profile as Profile | undefined
  const payerName = payerP?.display_name ?? payerP?.name ?? payer?.name ?? '…'

  async function handleDelete() {
    await deleteExpense.mutateAsync(expense!.id)
    onClose()
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'tally-fade 0.18s ease' }}
      />
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 28, display: 'flex', flexDirection: 'column', gap: 10, animation: 'tally-slideup 0.26s cubic-bezier(.34,1.0,.5,1)' }}>

        {/* Sheet card */}
        <div style={{ background: T.surface, borderRadius: T.r.panel, overflow: 'hidden', boxShadow: T.shadowModal }}>

          {/* Expense header */}
          <div style={{ padding: '16px 18px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `0.5px solid ${T.line}` }}>
            <span style={{ width: 46, height: 46, borderRadius: T.r.card, background: T.surfaceAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {expense.category ?? '💸'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {expense.description}
              </div>
              <div style={{ fontSize: 12.5, color: T.inkMuted, marginTop: 2 }}>
                {payerName} paid · ${Number(expense.amount).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Split chips */}
          {expense.splits && expense.splits.length > 0 && (
            <div style={{ padding: '12px 18px 14px', borderBottom: `0.5px solid ${T.line}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 9 }}>
                Split equally · ${(Number(expense.amount) / expense.splits.length).toFixed(2)} each
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {expense.splits.map(split => {
                  const m    = memberById[split.group_member_id]
                  const p    = m?.profile as Profile | undefined
                  const name = p?.display_name ?? p?.name ?? m?.name ?? '…'
                  return (
                    <div key={split.group_member_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.surfaceAlt, borderRadius: T.r.pill, padding: '4px 10px 4px 5px' }}>
                      <Avatar profile={p} slot={slotFor(members, split.group_member_id)} size={22} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{name.split(' ')[0]}</span>
                      <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: FMONO }}>${Number(split.owed_amount).toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Edit */}
          <button
            onClick={onClose}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left', color: T.ink }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 11, background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                <path d="M11 2.5l4 4-8.5 8.5H2.5v-4L11 2.5z" stroke={T.ink} strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M9 4.5l4 4" stroke={T.ink} strokeWidth="1.6"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Edit expense</span>
            <svg width="6" height="11" viewBox="0 0 6 11" fill="none" style={{ marginLeft: 'auto', opacity: 0.2 }}>
              <path d="M1 1l4 4.5L1 10" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleteExpense.isPending}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', borderTop: `0.5px solid ${T.line}`, cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left', color: T.coralInk, opacity: deleteExpense.isPending ? 0.5 : 1 }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 11, background: T.coralSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                <polyline points="2.5,5 15.5,5" stroke={T.coralInk} strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M6 5V3.5h6V5" stroke={T.coralInk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3.5" y="5" width="11" height="10" rx="2" stroke={T.coralInk} strokeWidth="1.6"/>
                <path d="M9 8v4" stroke={T.coralInk} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {deleteExpense.isPending ? 'Deleting…' : 'Delete expense'}
            </span>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{ width: '100%', padding: '16px', borderRadius: T.r.panel, background: T.surface, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 700, color: T.ink, boxShadow: T.shadowModal }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  )
}
