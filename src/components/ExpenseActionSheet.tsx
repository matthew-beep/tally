'use client'

import { useState, useEffect } from 'react'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { EmojiTile } from '@/components/EmojiTile'
import { SectionLabel } from '@/components/SectionLabel'
import { ModalOrSheet, ModalContent, ModalFooter } from '@/components/modal'
import { Btn } from '@/components/Btn'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import { formatAmount } from '@/lib/money'
import { calcExpenseNets, isPersonal } from '@/lib/balance'
import { ReactionPills } from '@/components/ReactionPills'
import { CommentsList } from '@/components/CommentsList'
import { useDeleteExpense } from '@/queries/useExpenses'
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
  /** Edit opens the add-expense form pre-filled — owned by the page, not this sheet. */
  onEdit: (expense: Expense) => void
}

type Screen = 'detail' | 'delete-confirm'

/** Midnight-qualified so a bare YYYY-MM-DD isn't parsed as UTC and shown a day early. */
function expenseDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function splitCaption(expense: Expense): string {
  const n = (expense.splits ?? []).filter(s => Number(s.owed_amount) > 0).length
  if (isPersonal(expense)) return 'Nothing borrowed'
  if (n === 1)             return 'Full amount'
  if (expense.split_type === 'equal' && n > 0) {
    return `Split ${n} ways · ${formatAmount(Number(expense.amount) / n)} each`
  }
  if (expense.split_type === 'exact')      return 'Split by exact amounts'
  if (expense.split_type === 'percentage') return 'Split by percentage'
  if (expense.split_type === 'itemized')   return 'Split by items'
  return 'Split'
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
// the point of the sheet, with reactions and comments below the split.
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
  // A payer with no share of their own (fronted it for others) has no row.
  const shares    = calcExpenseNets(expense, members.map(m => m.id)).filter(r => r.owed > 0)

  return (
    <ModalContent style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Head — identity, then the headline: what was paid and by whom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <EmojiTile emoji={expense.category ?? '💸'} size={50} fontSize={25} radius={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {expense.description}
            </div>
            <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 2 }}>
              {expenseDay(expense.expense_date)}
              {edited && <span style={{ marginLeft: 5 }}>(edited)</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: T.ink }}>
            {formatAmount(Number(expense.amount))}
          </span>
          <span style={{ fontSize: 14, color: T.inkMuted }}>
            paid by <span style={{ color: T.ink, fontWeight: 600 }}>{payerName}</span>
          </span>
        </div>
      </div>

      {/* Each participant's share of this expense — not a running balance,
          so no green/red: owing your share here says nothing about whether
          you're up or down in the group overall. */}
      <div>
        <SectionLabel size="sm" style={{ marginBottom: 8, padding: '0 2px' }}>{splitCaption(expense)}</SectionLabel>
        {isPersonal(expense) ? (
          <div style={{ background: T.surfaceAlt, borderRadius: T.r.card, padding: '12px 14px', fontSize: 13, color: T.inkMuted }}>
            Only {payerName === 'You' ? 'you' : payerName} in this split — no one owes anything.
          </div>
        ) : (
        <div style={{ background: T.surfaceAlt, borderRadius: T.r.card, overflow: 'hidden' }}>
          {shares.map((row, i) => {
            const m       = memberById[row.memberId]
            const isYou   = row.memberId === mySeatId
            const name    = isYou ? 'You' : m ? firstName(displayName(m)) : '…'
            const verb    = isYou ? 'owe' : 'owes'
            return (
              <div key={row.memberId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
                <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, row.memberId)} size={28} isYou={isYou} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{name}</span>
                  <span style={{ fontSize: 13, color: T.inkMuted }}>{verb}</span>
                </div>
                <span style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 700, flexShrink: 0, color: T.ink }}>
                  {formatAmount(row.owed)}
                </span>
              </div>
            )
          })}
        </div>
        )}
      </div>

      <ReactionPills
        expenseId={expense.id}
        groupId={groupId}
        mySeatId={mySeatId}
        canPost={canPost}
        size="drawer"
        label="Reactions"
      />

      <CommentsList
        expenseId={expense.id}
        groupId={groupId}
        members={members}
        mySeatId={mySeatId}
        canPost={canPost}
      />
    </ModalContent>
  )
}

// ── Root sheet ───────────────────────────────────────────────────────────
export function ExpenseActionSheet({ expense, members, groupId, mySeatId, canPost = false, onClose, onEdit }: Props) {
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

  const title = screen === 'delete-confirm' ? 'Delete this expense?' : displayExpense.description

  return (
    <ModalOrSheet open={!!expense} onClose={handleClose} title={title} maxWidth={460}>
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
              onClick={() => onEdit(displayExpense)} variant="cocoa" size="lg"
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
