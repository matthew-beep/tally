'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'
import { useDeleteExpense, useUpdateExpense } from '@/queries/useExpenses'
import type { Expense, GroupMember } from '@/types'

interface Props {
  expense: Expense | null
  members: GroupMember[]
  groupId: string
  onClose: () => void
}

type Screen = 'actions' | 'edit' | 'delete-confirm'

function slotFor(members: { id: string }[], id: string): 0 | 1 | 2 | 3 {
  const idx = members.findIndex(m => m.id === id)
  return Math.max(0, idx) % 4 as 0 | 1 | 2 | 3
}

function stripNegative(v: string) {
  return v.replace(/-/g, '')
}

// Shared sheet chrome — backdrop + slide-up card, matches the action sheet's own frame.
function SheetFrame({ onBackdropClick, children, zIndex = 300 }: { onBackdropClick: () => void; children: React.ReactNode; zIndex?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex }}>
      <div
        onClick={onBackdropClick}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'tally-fade 0.18s ease' }}
      />
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 28, display: 'flex', flexDirection: 'column', gap: 10, animation: 'tally-slideup 0.26s cubic-bezier(.34,1.0,.5,1)', maxHeight: 'calc(100vh - 56px)' }}>
        {children}
      </div>
    </div>
  )
}

function DirtyDot() {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.sun, display: 'inline-block' }} />
}

// ── Edit expense drawer ───────────────────────────────────────────────────
function ExpenseEditDrawer({
  expense, members, groupId, onCancel, onSaved,
}: {
  expense: Expense
  members: GroupMember[]
  groupId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const updateExpense = useUpdateExpense(groupId)
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const splitMembers = (expense.splits ?? [])
    .map(s => memberById[s.group_member_id])
    .filter((m): m is GroupMember => !!m)

  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount]           = useState(Number(expense.amount).toFixed(2))
  const [paidBy, setPaidBy]           = useState(expense.paid_by)

  const amt = parseFloat(amount) || 0
  const descDirty   = description !== expense.description
  const amountDirty = amount !== Number(expense.amount).toFixed(2)
  const payerDirty  = paidBy !== expense.paid_by
  const isDirty     = descDirty || amountDirty || payerDirty
  const canSave     = isDirty && !!description.trim() && amt > 0 && !updateExpense.isPending

  async function handleSave() {
    if (!canSave) return
    await updateExpense.mutateAsync({ expense, description: description.trim(), amount: amt, paid_by: paidBy })
    onSaved()
  }

  const fieldBox = (dirty: boolean) => ({
    background: T.surfaceAlt, borderRadius: 14,
    boxShadow: dirty ? `inset 0 0 0 1.5px ${T.sun}` : `inset 0 0 0 1px ${T.line}`,
    transition: 'box-shadow 0.18s',
  })
  const fieldLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.7,
    textTransform: 'uppercase', color: T.inkMuted, padding: '0 4px 6px',
    display: 'flex', alignItems: 'center', gap: 6,
  }

  return (
    <SheetFrame onBackdropClick={onCancel} zIndex={320}>
      <div style={{ background: T.surface, borderRadius: T.r.panel, overflow: 'hidden', boxShadow: T.shadowModal, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 84px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.lineStrong }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px 12px', borderBottom: `0.5px solid ${T.line}`, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2, color: T.ink }}>Edit expense</span>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              border: 0, cursor: canSave ? 'pointer' : 'default', font: 'inherit',
              padding: '7px 16px', borderRadius: 999,
              background: canSave ? T.sun : T.lineStrong,
              color: canSave ? T.sunInk : T.inkFaint,
              fontFamily: F, fontSize: 13, fontWeight: 700, transition: 'all 0.18s',
            }}
          >{updateExpense.isPending ? 'Saving…' : 'Save'}</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: T.sunSoft, borderRadius: 12, fontSize: 12, lineHeight: 1.5, color: T.sunInk }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="8" cy="8" r="6.5" stroke={T.sunInk} strokeWidth="1.3" fill="none" />
              <path d="M8 4.5v4M8 11v.4" stroke={T.sunInk} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span><b>Saving will mark this as modified.</b> Others will see <span style={{ fontFamily: FMONO }}>(edited)</span> in the activity feed.</span>
          </div>

          <div>
            <div style={fieldLabel}>Amount {amountDirty && <DirtyDot />}</div>
            <div style={{ ...fieldBox(amountDirty), padding: '10px 14px', display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 18, color: T.inkMuted, fontFamily: FH, fontWeight: 500 }}>$</span>
              <input
                type="number" inputMode="decimal" min={0}
                value={amount}
                onChange={e => setAmount(stripNegative(e.target.value))}
                style={{ border: 0, outline: 0, background: 'transparent', fontFamily: FH, fontSize: 26, fontWeight: 600, letterSpacing: -0.6, color: T.ink, width: '100%' }}
              />
            </div>
          </div>

          <div>
            <div style={fieldLabel}>Description {descDirty && <DirtyDot />}</div>
            <div style={{ ...fieldBox(descDirty), padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{expense.category ?? '💸'}</span>
              <input
                value={description} onChange={e => setDescription(e.target.value)}
                style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div>
            <div style={fieldLabel}>Paid by {payerDirty && <DirtyDot />}</div>
            <div style={{ ...fieldBox(payerDirty), padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {splitMembers.map(m => {
                const on = paidBy === m.id
                return (
                  <button
                    key={m.id} type="button" onClick={() => setPaidBy(m.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 11px 4px 4px', borderRadius: 999,
                      background: on ? T.ink : 'transparent', color: on ? T.bg : T.ink,
                      boxShadow: on ? 'none' : `inset 0 0 0 1px ${T.lineStrong}`,
                      border: 0, cursor: 'pointer', font: 'inherit',
                      fontSize: 12.5, fontWeight: 600, transition: 'all 0.12s',
                    }}
                  >
                    <Avatar profile={avatarProfile(m)} slot={slotFor(members, m.id)} size={22} />
                    {displayName(m).split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div style={fieldLabel}>Split among</div>
            <div style={{ ...fieldBox(false), padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(expense.splits ?? []).map(split => {
                const m = memberById[split.group_member_id]
                if (!m) return null
                return (
                  <div key={split.group_member_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.surface, borderRadius: T.r.pill, padding: '4px 10px 4px 5px', boxShadow: `inset 0 0 0 1px ${T.line}` }}>
                    <Avatar profile={avatarProfile(m)} slot={slotFor(members, m.id)} size={22} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{displayName(m).split(' ')[0]}</span>
                    <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: FMONO }}>${Number(split.owed_amount).toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onCancel}
        style={{ width: '100%', padding: '16px', borderRadius: T.r.panel, background: T.surface, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 700, color: T.ink, boxShadow: T.shadowModal, flexShrink: 0 }}
      >
        Cancel
      </button>
    </SheetFrame>
  )
}

// ── Delete confirm drawer ─────────────────────────────────────────────────
function DeleteConfirmDrawer({
  expense, memberCount, isPending, onCancel, onConfirm,
}: {
  expense: Expense
  memberCount: number
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <SheetFrame onBackdropClick={onCancel} zIndex={320}>
      <div style={{ background: T.surface, borderRadius: T.r.panel, overflow: 'hidden', boxShadow: T.shadowModal, padding: '0 18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 16px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.lineStrong }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: T.coralSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h16M9 8V6h6v2M8 8l1 12h6l1-12" stroke={T.coralInk} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>Delete this expense?</div>
            <div style={{ fontSize: 12.5, color: T.inkMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {expense.category ?? '💸'} {expense.description}
            </div>
          </div>
        </div>

        <div style={{ background: T.coralSoft, borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.coralInk, lineHeight: 1.5 }}>
            Balances for {memberCount} {memberCount === 1 ? 'person' : 'people'} will be recalculated.
          </div>
          <div style={{ fontSize: 11.5, color: T.coralInk, opacity: 0.8, marginTop: 3 }}>This can&apos;t be undone.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              width: '100%', padding: '14px', borderRadius: 16,
              background: T.coral, color: '#fff', border: 0, cursor: isPending ? 'default' : 'pointer',
              font: 'inherit', fontSize: 15, fontWeight: 700, opacity: isPending ? 0.6 : 1,
              boxShadow: `0 4px 16px ${T.coral}55`,
            }}
          >{isPending ? 'Deleting…' : 'Delete expense'}</button>
          <button
            onClick={onCancel}
            style={{ width: '100%', padding: '14px', borderRadius: 16, background: T.surfaceAlt, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 15, fontWeight: 700, color: T.inkMuted }}
          >Cancel</button>
        </div>
      </div>
    </SheetFrame>
  )
}

// ── Root action sheet ──────────────────────────────────────────────────────
export function ExpenseActionSheet({ expense, members, groupId, onClose }: Props) {
  const deleteExpense = useDeleteExpense(groupId)
  const [mounted, setMounted] = useState(false)
  const [screen, setScreen] = useState<Screen>('actions')
  useEffect(() => setMounted(true), [])
  useBodyScrollLock(!!expense)

  useEffect(() => {
    if (expense) setScreen('actions')
  }, [expense?.id])

  useEffect(() => {
    if (!expense) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (screen !== 'actions') setScreen('actions')
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expense, screen, onClose])

  if (!expense || !mounted) return null

  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const payer     = memberById[expense.paid_by]
  const payerName = payer ? displayName(payer) : '…'

  function handleClose() {
    setScreen('actions')
    onClose()
  }

  async function handleConfirmDelete() {
    await deleteExpense.mutateAsync(expense!.id)
    handleClose()
  }

  if (screen === 'edit') {
    return createPortal(
      <ExpenseEditDrawer
        expense={expense}
        members={members}
        groupId={groupId}
        onCancel={() => setScreen('actions')}
        onSaved={handleClose}
      />,
      document.body,
    )
  }

  if (screen === 'delete-confirm') {
    return createPortal(
      <DeleteConfirmDrawer
        expense={expense}
        memberCount={expense.splits?.length ?? members.length}
        isPending={deleteExpense.isPending}
        onCancel={() => setScreen('actions')}
        onConfirm={handleConfirmDelete}
      />,
      document.body,
    )
  }

  return createPortal(
    <SheetFrame onBackdropClick={handleClose}>

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
                const name = m ? displayName(m) : '…'
                return (
                  <div key={split.group_member_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.surfaceAlt, borderRadius: T.r.pill, padding: '4px 10px 4px 5px' }}>
                    <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, split.group_member_id)} size={22} />
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
          onClick={() => setScreen('edit')}
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
          onClick={() => setScreen('delete-confirm')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', borderTop: `0.5px solid ${T.line}`, cursor: 'pointer', font: 'inherit', fontFamily: F, textAlign: 'left', color: T.coralInk }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 11, background: T.coralSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
              <polyline points="2.5,5 15.5,5" stroke={T.coralInk} strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M6 5V3.5h6V5" stroke={T.coralInk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3.5" y="5" width="11" height="10" rx="2" stroke={T.coralInk} strokeWidth="1.6"/>
              <path d="M9 8v4" stroke={T.coralInk} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Delete expense</span>
        </button>
      </div>

      {/* Cancel */}
      <button
        onClick={handleClose}
        style={{ width: '100%', padding: '16px', borderRadius: T.r.panel, background: T.surface, border: 0, cursor: 'pointer', font: 'inherit', fontFamily: FH, fontSize: 16, fontWeight: 700, color: T.ink, boxShadow: T.shadowModal }}
      >
        Cancel
      </button>
    </SheetFrame>,
    document.body,
  )
}
