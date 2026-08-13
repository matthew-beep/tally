'use client'

import { useState, useEffect } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { EmojiTile } from '@/components/EmojiTile'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalContent, ModalFooter } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import { formatAmount, stripNegative } from '@/lib/money'
import { calcExpenseNets } from '@/lib/balance'
import { ReactionPills } from '@/components/ReactionPills'
import { useDeleteExpense, useUpdateExpense } from '@/queries/useExpenses'
import type { Expense, GroupMember } from '@/types'

interface Props {
  expense: Expense | null
  members: GroupMember[]
  groupId: string
  /** The viewer's seat in this group — renders their own split row as "You". */
  mySeatId?: string
  /**
   * Whether the viewer may write social content. False for guests (no
   * user_id, so the RLS author check can never pass) and left members
   * (excluded by the group gate) — without it the UI offers actions the
   * database will reject in silence.
   */
  canPost?: boolean
  onClose: () => void
}

type Screen = 'detail' | 'edit' | 'delete-confirm'

/** Midnight-qualified so a bare YYYY-MM-DD isn't parsed as UTC and shown a day early. */
function expenseDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function splitCaption(expense: Expense): string {
  const n = expense.splits?.length ?? 0
  if (expense.split_type === 'equal' && n > 0) {
    return `Split ${n} ways · ${formatAmount(Number(expense.amount) / n)} each`
  }
  if (expense.split_type === 'exact')      return 'Split by exact amounts'
  if (expense.split_type === 'percentage') return 'Split by percentage'
  if (expense.split_type === 'itemized')   return 'Split by items'
  return 'Split'
}

function DirtyDot() {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.sun, display: 'inline-block' }} />
}

// ── Edit expense ─────────────────────────────────────────────────────────
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
  const fieldLabelStyle: React.CSSProperties = { padding: '0 4px 6px', display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: T.ink }}>Edit expense</span>
        <Btn
          onClick={handleSave} disabled={!canSave} variant="primary" size="sm"
          style={{ fontWeight: 700, transition: 'all 0.18s' }}
        >{updateExpense.isPending ? 'Saving…' : 'Save'}</Btn>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: T.sunSoft, borderRadius: 12, fontSize: 12, lineHeight: 1.5, color: T.sunInk }}>
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="8" cy="8" r="6.5" stroke={T.sunInk} strokeWidth="1.3" fill="none" />
          <path d="M8 4.5v4M8 11v.4" stroke={T.sunInk} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span><b>Saving will mark this as modified.</b> Others will see <span style={{ fontFamily: FMONO }}>(edited)</span> in the activity feed.</span>
      </div>

      <div>
        <SectionLabel size="sm" style={fieldLabelStyle}>Amount {amountDirty && <DirtyDot />}</SectionLabel>
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
        <SectionLabel size="sm" style={fieldLabelStyle}>Description {descDirty && <DirtyDot />}</SectionLabel>
        <div style={{ ...fieldBox(descDirty), padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{expense.category ?? '💸'}</span>
          <input
            value={description} onChange={e => setDescription(e.target.value)}
            style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div>
        <SectionLabel size="sm" style={fieldLabelStyle}>Paid by {payerDirty && <DirtyDot />}</SectionLabel>
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
                {firstName(displayName(m))}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <SectionLabel size="sm" style={fieldLabelStyle}>Split among</SectionLabel>
        <div style={{ ...fieldBox(false), padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(expense.splits ?? []).map(split => {
            const m = memberById[split.group_member_id]
            if (!m) return null
            return (
              <div key={split.group_member_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.surface, borderRadius: T.r.pill, padding: '4px 10px 4px 5px', boxShadow: `inset 0 0 0 1px ${T.line}` }}>
                <Avatar profile={avatarProfile(m)} slot={slotFor(members, split.group_member_id)} size={22} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{firstName(displayName(m))}</span>
                <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: FMONO }}>{formatAmount(Number(split.owed_amount))}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <Btn
          onClick={onCancel} variant="outline" size="md"
          style={{ flex: 1, fontFamily: F }}
        >Cancel</Btn>
        <Btn
          onClick={handleSave} disabled={!canSave} variant="primary" size="md"
          style={{ flex: 2, fontSize: 14.5, transition: 'all 0.18s' }}
        >{updateExpense.isPending ? 'Saving…' : 'Save changes'}</Btn>
      </div>
    </ModalContent>
  )
}

// ── Delete confirm ───────────────────────────────────────────────────────
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
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

      <div style={{ background: T.coralSoft, borderRadius: 14, padding: '12px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.coralInk, lineHeight: 1.5 }}>
          Balances for {memberCount} {memberCount === 1 ? 'person' : 'people'} will be recalculated.
        </div>
        <div style={{ fontSize: 11.5, color: T.coralInk, opacity: 0.8, marginTop: 3 }}>This can&apos;t be undone.</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn
          onClick={onCancel} variant="outline" size="lg"
          style={{ flex: 1, fontFamily: F, fontSize: 14 }}
        >Cancel</Btn>
        <Btn
          onClick={onConfirm} disabled={isPending} variant="danger" size="lg"
          style={{ flex: 1, fontFamily: F, fontSize: 14 }}
        >{isPending ? 'Deleting…' : 'Delete expense'}</Btn>
      </div>
    </ModalContent>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────
// Content-first view of one expense: what it was, who fronted it, and what it
// did to each participant. Edit/Delete live in the footer rather than being
// the point of the sheet. Reactions and comments land here next.
function ExpenseDetailScreen({
  expense, members, groupId, mySeatId, canPost,
}: {
  expense: Expense
  members: GroupMember[]
  groupId: string
  mySeatId?: string
  canPost: boolean
}) {
  const memberById: Record<string, GroupMember> = Object.fromEntries(members.map(m => [m.id, m]))
  const payer     = memberById[expense.paid_by]
  const payerName = payer ? (expense.paid_by === mySeatId ? 'You' : firstName(displayName(payer))) : '…'
  const edited    = expense.updated_at && expense.updated_at !== expense.created_at
  const nets      = calcExpenseNets(expense, members.map(m => m.id))

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Head — identity and the headline number */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <EmojiTile emoji={expense.category ?? '💸'} size={50} fontSize={25} radius={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {expense.description}
          </div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>
            <span style={{ color: T.inkMuted, fontWeight: 600 }}>{payerName}</span>
            {' paid · '}{expenseDay(expense.expense_date)}
            {edited && <span style={{ marginLeft: 5 }}>(edited)</span>}
          </div>
        </div>
        <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: T.ink, flexShrink: 0 }}>
          {formatAmount(Number(expense.amount))}
        </div>
      </div>

      {/* Per-person effect of this expense alone — not a running balance */}
      <div>
        <SectionLabel size="sm" style={{ marginBottom: 8, padding: '0 2px' }}>{splitCaption(expense)}</SectionLabel>
        <div style={{ background: T.surfaceAlt, borderRadius: T.r.card, overflow: 'hidden' }}>
          {nets.map((row, i) => {
            const m      = memberById[row.memberId]
            const isYou  = row.memberId === mySeatId
            const name   = isYou ? 'You' : m ? firstName(displayName(m)) : '…'
            const isPayer = row.memberId === expense.paid_by
            const settled = Math.abs(row.net) < 0.01
            return (
              <div key={row.memberId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
                <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, row.memberId)} size={28} isYou={isYou} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{name}</span>
                  {isPayer && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: T.sunInk, background: T.sunSoft, padding: '1.5px 6px', borderRadius: T.r.pill }}>
                      paid
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: FMONO, fontSize: 12.5, fontWeight: 700, flexShrink: 0, color: settled ? T.inkFaint : row.net > 0 ? T.mintInk : T.coralInk }}>
                  {settled ? '—' : formatAmount(row.net, { sign: true })}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <ReactionPills
        expenseId={expense.id}
        groupId={groupId}
        mySeatId={mySeatId}
        canPost={canPost}
        size="drawer"
        label="Reactions"
      />
    </ModalContent>
  )
}

// ── Root sheet ───────────────────────────────────────────────────────────
export function ExpenseActionSheet({ expense, members, groupId, mySeatId, canPost = false, onClose }: Props) {
  const deleteExpense = useDeleteExpense(groupId)
  const [screen, setScreen] = useState<Screen>('detail')

  // Sticky copy of the last non-null expense — ModalOrSheet stays mounted
  // and animates out based on `open`, not on `expense` going null, so
  // content must keep rendering from something that doesn't disappear on close.
  const [displayExpense, setDisplayExpense] = useState<Expense | null>(expense)
  useEffect(() => {
    if (expense) {
      setDisplayExpense(expense)
      setScreen('detail')
    }
  }, [expense?.id])

  if (!displayExpense) return null

  function handleClose() {
    setScreen('detail')
    onClose()
  }

  async function handleConfirmDelete() {
    await deleteExpense.mutateAsync(displayExpense!.id)
    handleClose()
  }

  const title = screen === 'edit' ? 'Edit expense' : screen === 'delete-confirm' ? 'Delete this expense?' : displayExpense.description

  return (
    <ModalOrSheet open={!!expense} onClose={handleClose} title={title} maxWidth={460}>
      {screen === 'edit' && (
        <ExpenseEditDrawer
          expense={displayExpense}
          members={members}
          groupId={groupId}
          onCancel={() => setScreen('detail')}
          onSaved={handleClose}
        />
      )}

      {screen === 'delete-confirm' && (
        <DeleteConfirmDrawer
          expense={displayExpense}
          memberCount={displayExpense.splits?.length ?? members.length}
          isPending={deleteExpense.isPending}
          onCancel={() => setScreen('detail')}
          onConfirm={handleConfirmDelete}
        />
      )}

      {screen === 'detail' && (
        <>
          <ExpenseDetailScreen
            expense={displayExpense}
            members={members}
            groupId={groupId}
            mySeatId={mySeatId}
            canPost={canPost}
          />

          {/* Edit/Delete are demoted to a footer — the sheet is about the
              expense, not about acting on it. ModalFooter is flexShrink:0
              inside the flex column both Sheet and ModalPanel provide, so it
              pins to the bottom while the detail above it scrolls. */}
          <ModalFooter style={{ justifyContent: 'stretch', gap: 9 }}>
            <Btn
              onClick={() => setScreen('edit')} variant="dark" size="lg"
              icon={
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                </svg>
              }
              style={{ flex: 1, padding: '13px 0', borderRadius: 13, fontFamily: F, fontSize: 14.5 }}
            >
              Edit
            </Btn>
            <Btn
              onClick={() => setScreen('delete-confirm')} variant="dangerOutline" size="lg"
              icon={
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.6 8h4.8l.6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              style={{ flex: 0.6, padding: '13px 0', borderRadius: 13, fontFamily: F, fontSize: 14.5 }}
            >
              Delete
            </Btn>
          </ModalFooter>
        </>
      )}
    </ModalOrSheet>
  )
}
