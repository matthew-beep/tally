'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { MemberCombobox } from '@/components/MemberCombobox'
import type { MemberEntry } from '@/components/MemberCombobox'
import { AddExpenseSheet } from '@/components/AddExpenseForm'
import { DeleteGroupSheet } from '@/components/DeleteGroupSheet'
import { GroupActionMenu } from '@/components/GroupActionMenu'
import { ExpenseActionSheet } from '@/components/ExpenseActionSheet'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements } from '@/queries/useSettlements'
import { useCurrentProfile } from '@/queries/useProfile'
import { calcNetBalances, calcPairwiseNets } from '@/lib/balance'
import { postJson } from '@/lib/api'
import { mergeFeed, type FeedItem } from '@/lib/feed'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import type { GroupMember, Expense, Settlement } from '@/types'

function slotFor(members: { id: string }[], id: string): 0 | 1 | 2 | 3 {
  const idx = members.findIndex(m => m.id === id)
  return Math.max(0, idx) % 4 as 0 | 1 | 2 | 3
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function GroupDetailPage() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()
  const qc      = useQueryClient()

  const [addExpenseOpen,  setAddExpenseOpen]  = useState(false)
  const [addMemberOpen,   setAddMemberOpen]   = useState(false)
  const [menuOpen,        setMenuOpen]        = useState(false)
  const [deleteOpen,      setDeleteOpen]      = useState(false)
  const [balanceExpanded, setBalanceExpanded] = useState(false)
  const [expenseSheet,    setExpenseSheet]    = useState<Expense | null>(null)
  const [pendingMembers,  setPendingMembers]  = useState<MemberEntry[]>([])
  const [adding,          setAdding]          = useState(false)
  const [addError,        setAddError]        = useState<string | null>(null)

  async function handleAddMembers() {
    if (!pendingMembers.length) return
    setAdding(true)
    setAddError(null)
    try {
      const members = pendingMembers.map(entry =>
        entry.type === 'user'
          ? { type: 'user' as const, profileId: entry.profile.id, name: entry.profile.display_name ?? entry.profile.name }
          : { type: 'guest' as const, name: entry.name }
      )
      await postJson('/api/groups/members/add', { groupId, members })
      qc.invalidateQueries({ queryKey: ['group_members', groupId] })
      setPendingMembers([])
      setAddMemberOpen(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add members')
    } finally {
      setAdding(false)
    }
  }

  function cancelAddMember() {
    setAddMemberOpen(false)
    setPendingMembers([])
    setAddError(null)
  }

  const { data: group,        isLoading: loadingGroup   } = useGroup(groupId)
  const { data: members = [], isLoading: loadingMembers } = useGroupMembers(groupId)
  const { data: expenses = []                           } = useExpenses(groupId)
  const { data: settlements = []                        } = useSettlements(groupId)
  const { data: profile                                 } = useCurrentProfile()

  const memberById: Record<string, GroupMember> = Object.fromEntries(
    members.map(m => [m.id, m as GroupMember])
  )

  const memberIds   = members.map(m => m.id)
  const net         = calcNetBalances(groupId, expenses, settlements, memberIds)
  const myMember    = members.find(m => m.user_id === profile?.id)
  const myId        = myMember?.id
  const myBal       = myId ? (net[myId] ?? 0) : 0
  const totalSpend  = expenses.reduce((s, e) => s + Number(e.amount), 0)

  // Pairwise nets from my perspective — positive = they owe me, negative = I owe them
  const pairwiseNets = myId ? calcPairwiseNets(myId, expenses, settlements) : {}

  // Desktop members ledger — sorted by group standing, highest first
  const orderedMembers = [...members].sort((a, b) => (net[b.id] ?? 0) - (net[a.id] ?? 0))

  const oweMeEntries = Object.entries(pairwiseNets).filter(([, v]) => v > 0.01)
  const IOweEntries  = Object.entries(pairwiseNets).filter(([, v]) => v < -0.01)
  const hasBalance   = oweMeEntries.length > 0 || IOweEntries.length > 0
  const netPositive  = myBal >= 0

  // Feed — sorted by created_at (mergeFeed), month-bucketed by expense/settled date
  const feed = mergeFeed(expenses, settlements)

  const dateOrder: string[] = []
  const byDate: Record<string, FeedItem[]> = {}
  for (const item of feed) {
    const label = monthLabel(item.type === 'expense' ? item.data.expense_date : item.data.settled_date)
    if (!byDate[label]) { byDate[label] = []; dateOrder.push(label) }
    byDate[label].push(item)
  }

  if (loadingGroup || loadingMembers) {
    return <div style={{ padding: 28, fontFamily: F, color: T.inkMuted, fontSize: 14 }}>Loading…</div>
  }

  if (!group) {
    return (
      <div style={{ padding: 28, fontFamily: F, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300 }}>
        <div style={{ fontSize: 40 }}>💸</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>Group not found</div>
        <button onClick={() => router.push('/groups')} style={{ marginTop: 4, padding: '10px 20px', background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
          Back to groups
        </button>
      </div>
    )
  }

  // Add member form used in desktop left column (trigger button lives in the "Members" row header)
  const addMemberForm = (
    <div style={{ background: T.surface, borderRadius: T.r.lg, padding: 14, boxShadow: T.shadow }}>
      <MemberCombobox
        value={pendingMembers}
        onChange={setPendingMembers}
        excludeIds={members.filter(m => m.user_id).map(m => m.user_id!)}
        autoFocus
      />
      {addError && (
        <div style={{ fontSize: 12, color: T.coralInk, marginTop: 8 }}>{addError}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button
          onClick={cancelAddMember}
          style={{ padding: '8px 14px', borderRadius: T.r.md, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: F }}
        >
          Cancel
        </button>
        <button
          onClick={handleAddMembers}
          disabled={!pendingMembers.length || adding}
          style={{ padding: '8px 16px', borderRadius: T.r.md, border: 0, cursor: pendingMembers.length ? 'pointer' : 'default', background: pendingMembers.length ? T.ink : T.surfaceAlt, color: pendingMembers.length ? T.bg : T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: F }}
        >
          {adding ? 'Adding…' : pendingMembers.length ? `Add ${pendingMembers.length} to group` : 'Add to group'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: F, color: T.ink }}>

      {/* ── Desktop: top app bar — breadcrumb, group search (placeholder), notifications (placeholder), avatar ── */}
      <div className="group-detail-topbar" style={{ height: 56, alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: `0.5px solid ${T.line}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.inkMuted }}>
          <button
            onClick={() => router.push('/groups')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
          >
            Groups
          </button>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: T.ink, fontWeight: 700 }}>{group.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: T.r.pill, background: T.surfaceAlt, color: T.inkMuted, fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke={T.inkMuted} strokeWidth="1.4"/>
              <path d="M10 10l3 3" stroke={T.inkMuted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Search this group
          </div>
          <button style={{ width: 34, height: 34, borderRadius: '50%', background: T.surfaceAlt, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 3.5c-2.5 0-4.2 1.9-4.2 4.5v2.6L4.5 13h11l-1.3-2.4V8c0-2.6-1.7-4.5-4.2-4.5z" stroke={T.inkMuted} strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8.3 15.5a1.7 1.7 0 003.4 0" stroke={T.inkMuted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          <Avatar profile={profile ?? undefined} slot={0} size={30} isYou />
        </div>
      </div>

      {/* ── Desktop: group header band — identity, one-line net status, stats, primary actions ── */}
      <div className="group-detail-header-band" style={{ padding: '22px 28px 20px', borderBottom: `0.5px solid ${T.line}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: T.r.lg, background: T.surface, border: `0.5px solid ${T.line}`, boxShadow: T.shadowSm, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, flexShrink: 0 }}>
            {group.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 700, letterSpacing: -0.7, color: T.ink, lineHeight: 1.1 }}>{group.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: Math.abs(myBal) < 0.01 ? T.inkFaint : netPositive ? T.mintInk : T.coralInk }}>
                {Math.abs(myBal) < 0.01 ? "You're settled up" : `${netPositive ? "You're owed" : 'You owe'} $${Math.abs(myBal).toFixed(2)}`}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.inkFaint }}/>
              <span style={{ fontSize: 13, color: T.inkMuted }}>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.inkFaint }}/>
              <span style={{ fontSize: 13, color: T.inkMuted }}>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.inkFaint }}/>
              <span style={{ fontSize: 13, color: T.inkMuted }}>${totalSpend.toFixed(0)} total spent</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            {Math.abs(myBal) >= 0.01 && (
              <button
                onClick={() => router.push(`/groups/${groupId}/settle`)}
                style={{ padding: '9px 16px', borderRadius: T.r.md, background: 'transparent', color: T.ink, border: 0, boxShadow: `inset 0 0 0 1px ${T.lineStrong}`, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700 }}
              >
                Settle up
              </button>
            )}
            <button
              onClick={() => setAddExpenseOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: T.r.md, background: T.ink, color: T.bg, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add expense
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              style={{ width: 36, height: 36, borderRadius: T.r.md, background: T.surface, border: `0.5px solid ${T.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: T.shadowSm }}
            >
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="5.5"  r="1.6" fill={T.inkMuted}/>
                <circle cx="10" cy="10.5" r="1.6" fill={T.inkMuted}/>
                <circle cx="10" cy="15.5" r="1.6" fill={T.inkMuted}/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile: header ── */}
      <header className="group-detail-header" style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => router.push('/groups')}
          style={{ width: 36, height: 36, borderRadius: T.r.md, background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke={T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{group.emoji}</span>
            <span style={{ fontFamily: FH, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.ink }}>
              {group.name}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>
            {members.length} {members.length === 1 ? 'person' : 'people'}
            {totalSpend > 0 ? ` · $${totalSpend.toFixed(0)} total` : ''}
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          style={{ width: 36, height: 36, borderRadius: T.r.md, background: T.surface, border: `0.5px solid ${T.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: T.shadowSm }}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="5.5"  r="1.6" fill={T.inkMuted}/>
            <circle cx="10" cy="10.5" r="1.6" fill={T.inkMuted}/>
            <circle cx="10" cy="15.5" r="1.6" fill={T.inkMuted}/>
          </svg>
        </button>
      </header>

      {/* ── Mobile: avatar strip + add member trigger ── */}
      <div className="group-detail-mobile-strip" style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex' }}>
          {members.map((m, i) => (
            /* Pending members render dimmed — no room for a chip at 22px */
            <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: members.length - i, width: 26, height: 26, borderRadius: '50%', border: `2px solid ${T.bg}`, flexShrink: 0, overflow: 'hidden', opacity: m.status === 'pending' ? 0.45 : 1 }}>
              <Avatar profile={avatarProfile(m)} slot={i % 4 as 0 | 1 | 2 | 3} size={22} isYou={m.user_id === profile?.id} />
            </div>
          ))}
        </div>
        <button
          onClick={() => setAddMemberOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.sun, padding: 0, letterSpacing: -0.1 }}
        >
          + Add member
        </button>
      </div>

      {/* ── Mobile: inline add member combobox ── */}
      {addMemberOpen && (
        <div className="group-detail-mobile-strip" style={{ margin: '0 16px 12px', display: 'block', flexShrink: 0 }}>
          <div style={{ background: T.surface, borderRadius: T.r.lg, padding: 14, boxShadow: T.shadow }}>
            <MemberCombobox
              value={pendingMembers}
              onChange={setPendingMembers}
              excludeIds={members.filter(m => m.user_id).map(m => m.user_id!)}
              autoFocus
            />
            {addError && (
              <div style={{ fontSize: 12, color: T.coralInk, marginTop: 8 }}>{addError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelAddMember}
                style={{ padding: '8px 14px', borderRadius: T.r.md, background: 'transparent', color: T.inkMuted, border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: F }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={!pendingMembers.length || adding}
                style={{ padding: '8px 16px', borderRadius: T.r.md, border: 0, cursor: pendingMembers.length ? 'pointer' : 'default', background: pendingMembers.length ? T.ink : T.surfaceAlt, color: pendingMembers.length ? T.bg : T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: F }}
              >
                {adding ? 'Adding…' : pendingMembers.length ? `Add ${pendingMembers.length} to group` : 'Add to group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2-column body ── */}
      <div className="group-detail-body">

        {/* ── Left column (desktop only) — members ledger, sorted by standing. Net status now lives
             in the header band above; balances aren't duplicated here. ── */}
        <div className="group-detail-left">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted }}>Members</span>
              {!addMemberOpen && (
                <button
                  onClick={() => setAddMemberOpen(true)}
                  style={{ fontSize: 12, fontWeight: 700, color: T.sunInk, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: '2px 4px' }}
                >
                  + Add
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orderedMembers.map(m => {
                const name     = displayName(m)
                const isYou    = m.user_id === profile?.id
                const pending  = m.status === 'pending'
                const bal      = net[m.id] ?? 0
                const balColor = Math.abs(bal) < 0.01 ? T.inkFaint : bal > 0 ? T.mintInk : T.coralInk
                const balStr   = Math.abs(bal) < 0.01
                  ? '$0.00'
                  : `${bal > 0 ? '+' : '−'}$${Math.abs(bal).toFixed(2)}`
                const caption  = isYou ? 'your net' : Math.abs(bal) < 0.01 ? 'settled' : bal > 0 ? 'is owed' : 'owes the group'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 8px', borderRadius: T.r.md }}>
                    <Avatar profile={avatarProfile(m)} slot={slotFor(members, m.id)} size={32} isYou={isYou} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: pending ? T.inkMuted : T.ink, lineHeight: 1.2 }}>{isYou ? 'You' : name.split(' ')[0]}</div>
                      <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{pending ? '⏳ invited' : caption}</div>
                    </div>
                    {!pending && (
                      <div style={{ fontFamily: FH, fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: balColor }}>
                        {balStr}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {addMemberOpen && (
              <div style={{ marginTop: 10 }}>
                {addMemberForm}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column / mobile scrollable body ── */}
        <div className="group-detail-right">

          {expenses.length === 0 ? (

            /* ══ EMPTY STATE ══ */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 0', textAlign: 'center', gap: 10 }}>
              <div style={{ width: 72, height: 72, borderRadius: T.r.xl, background: T.surface, border: `0.5px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: T.shadowSm }}>
                {group.emoji}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>No expenses yet</div>
              <div style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.55, maxWidth: 220 }}>
                Add your first expense and it'll appear here, split across everyone.
              </div>
              {/* Member preview — mobile only; desktop has left column */}
              <div className="group-detail-empty-members" style={{ width: '100%', background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', marginTop: 16, boxShadow: T.shadowSm }}>
                {members.map((m, i) => {
                  const name    = displayName(m)
                  const isYou   = m.user_id === profile?.id
                  const pending = m.status === 'pending'
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
                      <Avatar profile={avatarProfile(m)} slot={i % 4 as 0 | 1 | 2 | 3} size={34} isYou={isYou} />
                      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: pending ? T.inkMuted : T.ink }}>{isYou ? 'You' : name}</div>
                      <div style={{ fontSize: 13, color: T.inkFaint, fontFamily: FMONO }}>{pending ? '⏳' : '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>

          ) : (

            /* ══ POPULATED STATE ══ */
            <>

              {/* ── Collapsible balance card — mobile only ── */}
              <div className="group-detail-balance-card" style={{ marginBottom: 20, background: T.surface, border: `0.5px solid ${T.line}`, boxShadow: T.shadowSm, borderRadius: T.r.lg, overflow: 'hidden' }}>
                <button
                  onClick={() => hasBalance && setBalanceExpanded(o => !o)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: hasBalance ? 'pointer' : 'default', font: 'inherit', textAlign: 'left', padding: '16px', borderBottom: balanceExpanded ? `0.5px solid ${T.line}` : 'none' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.55, textTransform: 'uppercase', color: T.inkMuted, marginBottom: 7 }}>
                      {Math.abs(myBal) < 0.01 ? 'All square' : netPositive ? 'Owed to you' : 'You owe'}
                    </div>
                    <div style={{ fontFamily: FH, fontSize: 30, fontWeight: 600, letterSpacing: -0.9, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: Math.abs(myBal) < 0.01 ? T.inkFaint : netPositive ? T.mintInk : T.coralInk }}>
                      {Math.abs(myBal) < 0.01 ? '—' : `$${Math.abs(myBal).toFixed(2)}`}
                    </div>
                    {hasBalance && (
                      <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 5, fontWeight: 500 }}>
                        {netPositive
                          ? `from ${oweMeEntries.length} ${oweMeEntries.length === 1 ? 'person' : 'people'}`
                          : `to ${IOweEntries.length} ${IOweEntries.length === 1 ? 'person' : 'people'}`}
                      </div>
                    )}
                  </div>
                  {hasBalance && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: balanceExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.22s ease', opacity: 0.35, flexShrink: 0 }}>
                      <path d="M3.5 6l4.5 4.5 4.5-4.5" stroke={T.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {balanceExpanded && (
                  <div>
                    {oweMeEntries.map(([memberId, amount]) => {
                      const m    = memberById[memberId]
                      const name = m ? displayName(m) : '…'
                      return (
                        <div key={memberId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderTop: `0.5px solid ${T.line}` }}>
                          <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, memberId)} size={30} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{name.split(' ')[0]}</span>
                            <span style={{ fontSize: 13, color: T.inkMuted }}> owes you </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.mintInk, fontVariantNumeric: 'tabular-nums' }}>${amount.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                    {IOweEntries.map(([memberId, amount]) => {
                      const m    = memberById[memberId]
                      const name = m ? displayName(m) : '…'
                      return (
                        <div key={memberId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderTop: `0.5px solid ${T.line}` }}>
                          <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotFor(members, memberId)} size={30} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>You owe {name.split(' ')[0]} </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.coralInk, fontVariantNumeric: 'tabular-nums' }}>${Math.abs(amount).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/groups/${groupId}/settle`) }}
                            style={{ flexShrink: 0, border: `1.5px solid ${T.coralInk}`, cursor: 'pointer', font: 'inherit', padding: '6px 13px', borderRadius: 9, background: 'transparent', color: T.coralInk, fontSize: 12, fontWeight: 700, letterSpacing: -0.1 }}
                          >
                            Settle up
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Expense + settlement feed ── */}
              {dateOrder.map(date => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted, padding: '0 4px 9px' }}>{date}</div>
                  <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: T.shadowSm }}>
                    {byDate[date].map((item, i) => {

                      if (item.type === 'expense') {
                        const e          = item.data
                        const payer      = memberById[e.paid_by]
                        const payerName  = payer ? displayName(payer) : '…'
                        const youPaid    = e.paid_by === myId
                        const mySplit    = e.splits?.find((s: { group_member_id: string }) => s.group_member_id === myId)
                        const myAmt      = youPaid
                          ? (e.splits ?? []).filter((s: { group_member_id: string }) => s.group_member_id !== e.paid_by).reduce((sum: number, s: { owed_amount: number }) => sum + Number(s.owed_amount), 0)
                          : (mySplit ? Number(mySplit.owed_amount) : 0)
                        const myInvolved = youPaid || !!mySplit
                        const edited     = e.updated_at && e.updated_at !== e.created_at
                        const inc        = (e.splits ?? []).map((s: { group_member_id: string }) => s.group_member_id)

                        return (
                          <div
                            key={e.id}
                            onClick={() => setExpenseSheet(e)}
                            style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 12, borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none', cursor: 'pointer' }}
                          >
                            <div style={{ width: 40, height: 40, borderRadius: T.r.md, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
                              {e.category ?? '💸'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {e.description}{edited && <span style={{ fontSize: 11, color: T.inkFaint, marginLeft: 5 }}>(edited)</span>}
                              </div>
                              <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span>{youPaid ? 'You paid' : `${payerName} paid`} · ${Number(e.amount).toFixed(2)}</span>
                                {/* Desktop only — who the expense is split among */}
                                <span className="group-detail-expense-split-info">
                                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.inkFaint }}/>
                                  <span>split {inc.length} ways</span>
                                  <span style={{ display: 'inline-flex', marginLeft: 2 }}>
                                    {inc.slice(0, 4).map((mid: string, k: number) => (
                                      <span key={mid} style={{ marginLeft: k > 0 ? -6 : 0, borderRadius: '50%', border: `1.5px solid ${T.surface}`, display: 'inline-flex' }}>
                                        <Avatar profile={memberById[mid] ? avatarProfile(memberById[mid]) : undefined} slot={slotFor(members, mid)} size={16} isYou={mid === myId} />
                                      </span>
                                    ))}
                                  </span>
                                </span>
                              </div>
                            </div>
                            {myInvolved && myAmt > 0 && (
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 700, color: youPaid ? T.mintInk : T.coralInk }}>
                                  {youPaid ? '+' : '−'}${myAmt.toFixed(2)}
                                </div>
                                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>your share</div>
                              </div>
                            )}
                          </div>
                        )
                      }

                      // settlement
                      const s          = item.data
                      const fromMember = memberById[s.from_member_id]
                      const toMember   = memberById[s.to_member_id]
                      const fromName   = fromMember ? displayName(fromMember) : '…'
                      const toName     = toMember ? displayName(toMember) : '…'
                      const youFrom    = s.from_member_id === myId
                      const youTo      = s.to_member_id   === myId

                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 12, borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none', background: s.status === 'confirmed' ? T.mintSoft : 'transparent' }}>
                          <div style={{ width: 40, height: 40, borderRadius: T.r.md, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {s.status === 'confirmed' ? '✓' : '⏳'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: s.status === 'confirmed' ? T.mintInk : T.ink }}>
                              {youFrom ? 'You' : fromName} paid {youTo ? 'you' : toName}
                            </div>
                            <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 2 }}>
                              {s.status === 'pending' ? 'Pending confirmation' : 'Confirmed'}{s.note ? ` · ${s.note}` : ''}
                            </div>
                          </div>
                          <div style={{ fontFamily: FMONO, fontSize: 13, fontWeight: 700, color: s.status === 'confirmed' ? T.mintInk : T.ink, flexShrink: 0 }}>
                            ${Number(s.amount).toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

            </>
          )}
        </div>
      </div>

      {/* ── Floating Add expense CTA — mobile only ── */}
      <div className="group-detail-fab" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 16px 28px', pointerEvents: 'none' }}>
        <button
          onClick={() => setAddExpenseOpen(true)}
          style={{ pointerEvents: 'auto', width: '100%', height: 54, borderRadius: T.r.lg, border: 0, cursor: 'pointer', background: T.sun, color: T.sunInk, fontFamily: FH, fontSize: 16.5, fontWeight: 600, letterSpacing: -0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: T.shadowFab }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span> Add expense
        </button>
      </div>

      <AddExpenseSheet
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        groupId={groupId}
      />

      {/* ── Sheets ── */}
      <GroupActionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        group={group}
        onAddMember={() => setAddMemberOpen(true)}
        onDeleteTap={() => setDeleteOpen(true)}
        onSettingsTap={() => router.push(`/groups/${groupId}/settings`)}
      />

      <DeleteGroupSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        group={group}
        expenses={expenses}
        settlements={settlements}
        members={members}
        groupId={groupId}
      />

      <ExpenseActionSheet
        expense={expenseSheet}
        members={members}
        groupId={groupId}
        onClose={() => setExpenseSheet(null)}
      />

    </div>
  )
}
