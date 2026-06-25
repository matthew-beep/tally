'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { MemberCombobox } from '@/components/MemberCombobox'
import type { MemberEntry } from '@/components/MemberCombobox'
import { ModalOrSheet, ActionSheet } from '@/components/modal'
import { AddExpenseForm } from '@/components/AddExpenseForm'
import { useGroup, useGroupMembers, useDeleteGroup } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements } from '@/queries/useSettlements'
import { useCurrentProfile } from '@/queries/useProfile'
import { addMembersToGroup, createGuestProfile } from '@/queries/useMembers'
import { calcNetBalances, simplifyDebts } from '@/lib/balance'
import type { Profile, Expense, Settlement } from '@/types'


function slotFor(members: { id: string }[], id: string): 0 | 1 | 2 | 3 {
  const idx = members.findIndex(m => m.id === id)
  return Math.max(0, idx) % 4 as 0 | 1 | 2 | 3
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function GroupDetailPage() {
  const params   = useParams()
  const groupId  = params.id as string
  const router   = useRouter()
  const qc       = useQueryClient()
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingMembers, setPendingMembers] = useState<MemberEntry[]>([])
  const [adding, setAdding] = useState(false)
  const deleteGroup = useDeleteGroup()

  async function handleAddMembers() {
    if (!pendingMembers.length) return
    setAdding(true)
    try {
      const ids: string[] = []
      for (const entry of pendingMembers) {
        if (entry.type === 'user') ids.push(entry.profile.id)
        else ids.push(await createGuestProfile(entry.name))
      }
      await addMembersToGroup(groupId, ids)
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
      setPendingMembers([])
      setAddMemberOpen(false)
    } finally {
      setAdding(false)
    }
  }

  const { data: group,       isLoading: loadingGroup   } = useGroup(groupId)
  const { data: members = [], isLoading: loadingMembers } = useGroupMembers(groupId)
  const { data: expenses = []                           } = useExpenses(groupId)
  const { data: settlements = []                        } = useSettlements(groupId)
  const { data: profile                                 } = useCurrentProfile()

  const memberById: Record<string, typeof members[0]> = Object.fromEntries(
    members.map(m => [m.id, m])
  )

  const memberIds = members.map(m => m.id)
  const net       = calcNetBalances(groupId, expenses, settlements, memberIds)
  const debts     = simplifyDebts(net)
  const myMember  = members.find(m => m.user_id === profile?.id)
  const myId      = myMember?.id
  const myBal     = myId ? (net[myId] ?? 0) : 0
  const isPos     = myBal >= 0
  const settled   = Math.abs(myBal) < 0.01

  const whole = Math.floor(Math.abs(myBal))
  const cents = (Math.abs(myBal) % 1).toFixed(2).slice(1)
  const sign  = settled ? '' : isPos ? '+' : '−'

  // Merge expenses + settlements into a date-grouped feed
  type FeedItem =
    | { _type: 'expense';    _date: string; data: Expense }
    | { _type: 'settlement'; _date: string; data: Settlement }

  const feed: FeedItem[] = [
    ...expenses.map(e => ({
      _type: 'expense' as const,
      _date: e.expense_date,
      data: e,
    })),
    ...settlements.map(s => ({
      _type: 'settlement' as const,
      _date: s.settled_date,
      data: s,
    })),
  ].sort((a, b) => {
    const aTime = a._type === 'expense' ? a.data.created_at : a.data.created_at
    const bTime = b._type === 'expense' ? b.data.created_at : b.data.created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  const byDate: Record<string, FeedItem[]> = {}
  for (const item of feed) {
    const label = dateLabel(item._date)
    if (!byDate[label]) byDate[label] = []
    byDate[label].push(item)
  }

  if (loadingGroup || loadingMembers) {
    return (
      <div style={{ padding: 28, fontFamily: F, color: T.inkMuted, fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  if (!group) {
    return (
      <div style={{ padding: 28, fontFamily: F, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300 }}>
        <div style={{ fontSize: 40 }}>💸</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>Group not found</div>
        <button
          onClick={() => router.push('/groups')}
          style={{ marginTop: 4, padding: '10px 20px', background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
        >
          Back to groups
        </button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflowY: 'auto', padding: 28, fontFamily: F, display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' }}>
        <button
          onClick={() => router.push('/groups')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px 6px 0', fontSize: 20, color: T.inkMuted }}
        >
          ←
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {group && profile?.id === group.created_by && (
            <button
              onClick={() => setMenuOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px', fontSize: 18, color: T.inkMuted, borderRadius: T.r.md }}
            >
              ···
            </button>
          )}
          <button
            onClick={() => setAddExpenseOpen(true)}
            style={{ background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
          >
            + Add expense
          </button>
        </div>
      </div>

      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: T.r.lg, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: T.shadowSm, flexShrink: 0 }}>
          {group.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, color: T.ink }}>{group.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
            {members.slice(0, 5).map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
                <Avatar
                  profile={(m as any).profile}
                  slot={i % 4 as 0 | 1 | 2 | 3}
                  size={24}
                  isYou={m.user_id === profile?.id}
                />
              </div>
            ))}
            <span style={{ marginLeft: 10, fontSize: 12, color: T.inkMuted }}>{members.length} {members.length === 1 ? 'person' : 'people'}</span>
            <button
              onClick={() => setAddMemberOpen(true)}
              style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: T.r.pill, border: `1.5px dashed ${T.lineStrong}`, background: 'transparent', color: T.inkMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F }}
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      {addMemberOpen && (
        <div style={{
          marginTop: 12, background: T.surface, borderRadius: T.r.lg,
          padding: 14, boxShadow: T.shadow,
        }}>
          <MemberCombobox
            value={pendingMembers}
            onChange={setPendingMembers}
            excludeIds={members.filter(m => m.user_id).map(m => m.user_id!)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setAddMemberOpen(false); setPendingMembers([]) }}
              style={{ padding: '8px 14px', borderRadius: T.r.md, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: F }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddMembers}
              disabled={!pendingMembers.length || adding}
              style={{
                padding: '8px 16px', borderRadius: T.r.md, border: 0, cursor: pendingMembers.length ? 'pointer' : 'default',
                background: pendingMembers.length ? T.ink : T.surfaceAlt,
                color: pendingMembers.length ? T.bg : T.inkMuted,
                fontSize: 13, fontWeight: 700, fontFamily: F,
              }}
            >
              {adding ? 'Adding…' : pendingMembers.length ? `Add ${pendingMembers.length} to group` : 'Add to group'}
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 8 }}>
          Members
        </div>
        <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: T.shadowSm }}>
          {members.map((m, i) => {
            const p = (m as any).profile as Profile | undefined
            const isYou     = m.user_id === profile?.id
            const isPending = m.status === 'pending'
            const isGuest   = !m.user_id
            const name      = p?.display_name ?? p?.name ?? m.name ?? '…'
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px',
                borderBottom: i < members.length - 1 ? `1px solid ${T.line}` : 'none',
              }}>
                <Avatar profile={p} slot={slotFor(members, m.id)} size={34} isYou={isYou} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isYou ? 'You' : name}
                  </div>
                  {p?.handle && !isGuest && (
                    <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: FMONO, marginTop: 1 }}>@{p.handle}</div>
                  )}
                </div>
                {isPending && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 999,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' as const,
                    background: T.sunSoft, color: T.sunInk, flexShrink: 0,
                  }}>
                    ⏳ Pending
                  </span>
                )}
                {isGuest && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 999,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' as const,
                    background: T.surfaceAlt, color: T.inkMuted, flexShrink: 0,
                  }}>
                    👤 Guest
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Balance hero */}
      <div style={{ padding: '22px 20px', background: T.surface, borderRadius: T.r.xl, boxShadow: T.shadowSm, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 8 }}>
          Your balance
        </div>
        <div style={{ lineHeight: 1, marginBottom: 4, color: settled ? T.mintInk : isPos ? T.mintInk : T.coralInk }}>
          <span style={{ fontFamily: FH, fontSize: 32, fontWeight: 500, opacity: 0.7 }}>{sign}$</span>
          <span style={{ fontFamily: FH, fontSize: 72, fontWeight: 700, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
          <span style={{ fontFamily: FMONO, fontSize: 18, opacity: 0.7 }}>{cents}</span>
        </div>
        <div style={{ fontSize: 13, color: T.inkMuted, marginBottom: 16 }}>
          {settled
            ? "You're all settled up in this group 🎉"
            : isPos
              ? 'Overall you are owed in this group'
              : 'Overall you owe in this group'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!settled && (
            <button
              onClick={() => router.push(`/groups/${groupId}/settle`)}
              style={{ flex: 1, padding: '11px 0', background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
            >
              Settle up
            </button>
          )}
          <button
            onClick={() => setAddExpenseOpen(true)}
            style={{ flex: 1, padding: '11px 0', background: settled ? T.ink : T.surface, color: settled ? T.bg : T.ink, border: settled ? 'none' : `1.5px solid ${T.lineStrong}`, borderRadius: T.r.md, fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
          >
            + Add expense
          </button>
        </div>
      </div>

      {/* Who pays who */}
      {debts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 8 }}>
            Who pays who
          </div>
          <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: T.shadowSm }}>
            {debts.map((debt, i) => {
              const fromMember  = memberById[debt.from]
              const toMember    = memberById[debt.to]
              const fromP       = (fromMember as any)?.profile as Profile | undefined
              const toP         = (toMember as any)?.profile as Profile | undefined
              const isMyDebt    = debt.from === myId
              const owedToMe    = debt.to === myId
              return (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < debts.length - 1 ? `1px solid ${T.line}` : 'none', gap: 10 }}
                >
                  <Avatar profile={fromP} slot={slotFor(members, debt.from)} size={32} isYou={fromMember?.user_id === profile?.id} />
                  <div style={{ width: 22, height: 22, background: T.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, color: T.inkMuted }}>→</div>
                  <Avatar profile={toP}   slot={slotFor(members, debt.to)}   size={32} isYou={toMember?.user_id === profile?.id} />
                  <div style={{ flex: 1, marginLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {fromP?.display_name ?? fromP?.name ?? fromMember?.name ?? '…'} → {toP?.display_name ?? toP?.name ?? toMember?.name ?? '…'}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1, fontFamily: FMONO }}>${debt.amount.toFixed(2)}</div>
                  </div>
                  {isMyDebt && (
                    <button
                      onClick={() => router.push(`/groups/${groupId}/settle`)}
                      style={{ padding: '6px 14px', background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.pill, fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
                    >
                      Pay
                    </button>
                  )}
                  {owedToMe && (
                    <button style={{ padding: '6px 14px', background: T.surface, color: T.inkMuted, border: `1px solid ${T.lineStrong}`, borderRadius: T.r.pill, fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                      Remind
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Group action menu */}
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={group ? `${group.emoji} ${group.name}` : undefined}
        items={[
          {
            id: 'add-member',
            label: 'Add member',
            icon: (
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <circle cx="8" cy="7" r="3" stroke={T.ink} strokeWidth="1.7"/>
                <path d="M2 17c0-3.3 2.7-5 6-5" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round"/>
                <path d="M15 12v4M13 14h4" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            ),
            onClick: () => setAddMemberOpen(true),
          },
          {
            id: 'delete',
            label: 'Delete group',
            sublabel: "Permanent — can't be undone",
            danger: true,
            icon: (
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path d="M4 6h12M8 6V4h4v2M7 6l1 10h4l1-10" stroke={T.coralInk} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
            onClick: () => setDeleteOpen(true),
          },
        ]}
      />

      {/* Delete group confirmation */}
      <ModalOrSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete group">
        <div style={{ padding: '8px 20px 44px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
              Delete {group?.name}?
            </div>
            <div style={{ fontSize: 14, color: T.inkMuted, lineHeight: 1.5 }}>
              This permanently deletes the group, all expenses, and all settlements. This cannot be undone.
            </div>
          </div>

          {/* Balance summary */}
          {members.length > 0 && (
            <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', border: `0.5px solid ${T.line}` }}>
              {members.map((m, i) => {
                const p = (m as any).profile as Profile | undefined
                const name = p?.display_name ?? p?.name ?? m.name ?? '…'
                const bal = Math.round((net[m.id] ?? 0) * 100) / 100
                const isYou = m.user_id === profile?.id
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                    borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none',
                  }}>
                    <Avatar profile={p} slot={slotFor(members, m.id)} size={32} isYou={isYou} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {isYou ? 'You' : name}
                    </div>
                    <div style={{
                      fontFamily: FMONO, fontSize: 13, fontWeight: 600,
                      color: Math.abs(bal) < 0.01 ? T.inkFaint : bal > 0 ? T.mintInk : T.coralInk,
                    }}>
                      {Math.abs(bal) < 0.01 ? 'Settled' : `${bal > 0 ? '+' : '−'}$${Math.abs(bal).toFixed(2)}`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setDeleteOpen(false)}
              style={{ flex: 1, padding: '14px 0', background: T.surfaceAlt, color: T.inkMuted, border: 'none', borderRadius: T.r.md, fontSize: 14, fontWeight: 700, fontFamily: F, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await deleteGroup.mutateAsync(groupId)
                router.push('/groups')
              }}
              disabled={deleteGroup.isPending}
              style={{ flex: 1, padding: '14px 0', background: T.coral, color: '#fff', border: 'none', borderRadius: T.r.md, fontSize: 14, fontWeight: 700, fontFamily: F, cursor: 'pointer', opacity: deleteGroup.isPending ? 0.6 : 1 }}
            >
              {deleteGroup.isPending ? 'Deleting…' : 'Delete group'}
            </button>
          </div>
        </div>
      </ModalOrSheet>

      {/* Add expense — Vaul sheet on mobile, modal on desktop */}
      <ModalOrSheet
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        title={group ? `Add expense — ${group.name}` : 'Add expense'}
        maxWidth={740}
        sheetContentClassName="add-expense-panel-root"
        sheetContentStyle={{ padding: 0, overflow: 'hidden' }}
        panelClassName="add-expense-panel-root"
        panelStyle={{ background: T.bg, padding: 0, overflow: 'hidden' }}
      >
        <AddExpenseForm
          groupId={groupId}
          onSuccess={() => setAddExpenseOpen(false)}
          onCancel={() => setAddExpenseOpen(false)}
        />
      </ModalOrSheet>

      {/* Activity feed */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 12 }}>
          Activity
        </div>

        {feed.length === 0 && (
          <div style={{ background: T.surface, borderRadius: T.r.lg, padding: '28px 20px', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>
            No expenses yet — add one to get started.
          </div>
        )}

        {Object.entries(byDate).map(([label, items]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.inkFaint, marginBottom: 6, paddingLeft: 2 }}>{label}</div>
            <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: T.shadowSm }}>
              {items.map((item, i) => {
                const isLast = i === items.length - 1
                const border = isLast ? 'none' : `1px solid ${T.line}`

                if (item._type === 'expense') {
                  const e = item.data
                  const payer       = memberById[e.paid_by]
                  const payerName   = payer?.profile?.display_name ?? payer?.name ?? '…'
                  const youPaid     = e.paid_by === myId
                  const mySplit     = e.splits?.find(s => s.group_member_id === myId)
                  const myAmt       = youPaid
                    ? (e.splits ?? []).filter(s => s.group_member_id !== e.paid_by).reduce((sum, s) => sum + Number(s.owed_amount), 0)
                    : (mySplit ? Number(mySplit.owed_amount) : 0)
                  const myInvolved  = youPaid || !!mySplit
                  const edited      = e.updated_at && e.updated_at !== e.created_at

                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12, borderBottom: border }}>
                      <div style={{ width: 38, height: 38, borderRadius: T.r.md, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        {e.category ?? '💸'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.description}{edited && <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 5 }}>(edited)</span>}
                        </div>
                        <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>
                          {youPaid ? 'You paid' : `${payerName} paid`} · {(e.splits?.length ?? 0)} people
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: T.ink }}>
                          ${Number(e.amount).toFixed(2)}
                        </div>
                        {myInvolved && myAmt > 0 && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: youPaid ? T.mintInk : T.coralInk, marginTop: 1 }}>
                            {youPaid ? '+' : '−'}${myAmt.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                // settlement
                const s          = item.data
                const fromMember  = memberById[s.from_member_id]
                const toMember    = memberById[s.to_member_id]
                const fromName    = fromMember?.profile?.display_name ?? fromMember?.name ?? '…'
                const toName      = toMember?.profile?.display_name   ?? toMember?.name   ?? '…'
                const youFrom     = s.from_member_id === myId
                const youTo       = s.to_member_id   === myId

                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12, borderBottom: border, background: s.status === 'confirmed' ? T.mintSoft : 'transparent' }}>
                    <div style={{ width: 38, height: 38, borderRadius: T.r.md, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {s.status === 'confirmed' ? '✓' : '⏳'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: s.status === 'confirmed' ? T.mintInk : T.ink }}>
                        {youFrom ? 'You' : fromName} paid {youTo ? 'you' : toName}
                      </div>
                      <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>
                        {s.status === 'pending' ? 'Pending confirmation' : 'Confirmed'}{s.note ? ` · ${s.note}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FMONO, color: s.status === 'confirmed' ? T.mintInk : T.ink, flexShrink: 0 }}>
                      ${Number(s.amount).toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
