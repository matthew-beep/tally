'use client'

import { useState, type CSSProperties } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar, AvatarStack } from '@/components/Avatar'
import { EmojiTile } from '@/components/EmojiTile'
import { SectionLabel } from '@/components/SectionLabel'
import { Btn } from '@/components/Btn'
import { Card } from '@/components/Card'
import { formatAmount } from '@/lib/money'
import { AddExpenseSheet } from '@/components/AddExpenseForm'
import { ExpenseActionSheet } from '@/components/ExpenseActionSheet'
import { SettleUpSheet } from '@/components/SettleUpSheet'
import { MemberBalancesModal } from '@/components/settle/MemberBalancesModal'
import { WhosAheadRow } from '@/components/leaderboard/WhosAheadRow'
import { LeaderboardSheet } from '@/components/leaderboard/LeaderboardSheet'
import { AppHeader } from '@/components/dashboard/AppHeader'
import { FeedCard } from '@/components/feed/FeedCard'
import { ReactionPills } from '@/components/ReactionPills'
import { toGroupFeedCard } from '@/lib/feedCards'
import { SettingsIcon } from 'lucide-react'
import { useGroupDetail } from '@/queries/useGroupDetail'
import { calcNetBalances, calcPairwiseNets } from '@/lib/balance'
import { calcLeaderboard } from '@/lib/leaderboard'
import { mergeFeed, type FeedItem } from '@/lib/feed'
import { avatarProfile, displayName, firstName, slotFor } from '@/lib/memberDisplay'
import type { GroupMember, Expense, Settlement, Transfer } from '@/types'

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function GroupDetailPage() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()
  const searchParams = useSearchParams()

  // ?add=1 opens the expense sheet on arrival — the deep-link target for the
  // FAB and for the legacy /groups/[id]/add URL. Read once as the initial
  // state so closing the sheet doesn't fight the param still being in the URL.
  const [addExpenseOpen,  setAddExpenseOpen]  = useState(() => searchParams.get('add') === '1')
  const [settleOpen,      setSettleOpen]      = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [expenseSheet,    setExpenseSheet]    = useState<Expense | null>(null)
  const [settleUser, setSettleUser] = useState<string | null>(null)
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null)

  const { group, loadingGroup, members, loadingMembers, expenses, settlements, profile } = useGroupDetail(groupId)

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

  // Leaderboard — gross fronted, ranked. Deliberately not `net`: this answers
  // "who's been covering the group", which settlements don't undo.
  const leaderboard = calcLeaderboard(groupId, expenses, memberIds)

  const oweMeEntries = Object.entries(pairwiseNets).filter(([, v]) => v > 0.01)
  const IOweEntries  = Object.entries(pairwiseNets).filter(([, v]) => v < -0.01)
  const hasBalance   = oweMeEntries.length > 0 || IOweEntries.length > 0
  const netPositive  = myBal >= 0

  // SettleUpSheet is props-driven — build its Transfer[] from data already
  // fetched here rather than having the sheet re-fetch/re-derive balances.
  function toTransfer(memberId: string, amount: number, direction: 'owed' | 'owe'): Transfer {
    const m = memberById[memberId]
    return {
      groupMemberId: memberId,
      amount,
      direction,
      name: m ? displayName(m) : '…',
      avatar: m ? avatarProfile(m) : { name: '…', display_name: null, avatar_url: null },
      slot: slotFor(members, memberId),
    }
  }
  const transfers: Transfer[] = [
    ...oweMeEntries.map(([id, amt]) => toTransfer(id, amt, 'owed')),
    ...IOweEntries.map(([id, amt]) => toTransfer(id, Math.abs(amt), 'owe')),
  ]
  const preselectTransfer = settleUser ? transfers.find(t => t.groupMemberId === settleUser) ?? null : null

  // Read-only view of another member's standing — Members column, desktop.
  // calcPairwiseNets is subject-agnostic, so this reuses the exact math and
  // toTransfer shaping that already power "my" balances above.
  const viewingMember = viewingMemberId ? memberById[viewingMemberId] : undefined
  const viewingNets   = viewingMemberId ? calcPairwiseNets(viewingMemberId, expenses, settlements) : {}
  const viewingTransfers: Transfer[] = viewingMemberId ? [
    ...Object.entries(viewingNets).filter(([, v]) => v > 0.01).map(([id, amt]) => toTransfer(id, amt, 'owed')),
    ...Object.entries(viewingNets).filter(([, v]) => v < -0.01).map(([id, amt]) => toTransfer(id, Math.abs(amt), 'owe')),
  ] : []

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
        <Btn onClick={() => router.push('/groups')} variant="dark" size="md" style={{ marginTop: 4, padding: '10px 20px', fontSize: 14 }}>
          Back to groups
        </Btn>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: F, color: T.ink }}>

      {/* ── Desktop: shared app header — breadcrumb + Add expense action ── */}
      <div className="group-detail-topbar">
        <AppHeader
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => router.push('/groups')}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 500, color: T.inkMuted }}
              >
                Groups
              </button>
              <span style={{ fontSize: 13, color: T.inkFaint }}>/</span>
              <span 
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 500, color: T.ink }}
                >
                {group.name}
              </span>
            </span>
          }
          action={{
            label: 'Add expense',
            onClick: () => setAddExpenseOpen(true),
            hideOnMobile: false,
          }}
        />
      </div>

      {/* ── Desktop: group header band — identity, one-line net status, stats, primary actions ── */}
      <div className="group-detail-header-band" style={{ padding: '22px 28px 20px', borderBottom: `0.5px solid ${T.line}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: T.r.lg, background: T.surface, border: `0.5px solid ${T.line}`, boxShadow: T.shadowSm, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, flexShrink: 0 }}>
            {group.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F, fontSize: 26, fontWeight: 700, letterSpacing: -0.7, color: T.ink, lineHeight: 1.1 }}>{group.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, color: Math.abs(myBal) < 0.01 ? T.inkFaint : netPositive ? T.mintInk : T.coralInk }}>
                {Math.abs(myBal) < 0.01 ? "You're settled up" : `${netPositive ? "You're owed" : 'You owe'} ${formatAmount(myBal)}`}
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
            <button
              onClick={() => router.push(`/groups/${groupId}/settings`)}
              style={{ width: 36, height: 36, borderRadius: T.r.md, background: T.surface, border: `0.5px solid ${T.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: T.shadowSm }}
            >
              <SettingsIcon size={17} color={T.inkMuted} />
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
            <span style={{ fontFamily: F, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.ink }}>
              {group.name}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>
            {members.length} {members.length === 1 ? 'person' : 'people'}
            {totalSpend > 0 ? ` · $${totalSpend.toFixed(0)} total` : ''}
          </div>
        </div>
        <button
          onClick={() => router.push(`/groups/${groupId}/settings`)}
          style={{ width: 36, height: 36, borderRadius: T.r.md, background: T.surface, border: `0.5px solid ${T.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: T.shadowSm }}
        >
          <SettingsIcon size={17} color={T.inkMuted} />
        </button>
      </header>

      {/* ── Mobile: avatar strip ── */}
      <div className="group-detail-mobile-strip" style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <AvatarStack
          members={members.map((m, i) => ({
            profile: avatarProfile(m),
            slot: i % 4 as 0 | 1 | 2 | 3,
            isYou: m.user_id === profile?.id,
            dimmed: m.status === 'pending',
          }))}
          size={22}
          max={8}
          overlap={8 / 22}
          ringColor={T.bg}
        />
      </div>



      {/* ── 2-column body ── */}
      <div className="group-detail-body">

        {/* ── Left column (desktop only) — members ledger, sorted by standing. Net status now lives
             in the header band above; balances aren't duplicated here. ── */}
        <div className="group-detail-left">
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}>
              <SectionLabel size="sm">Members</SectionLabel>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orderedMembers.map(m => {
                const name     = displayName(m)
                const isYou    = m.user_id === profile?.id
                const pending  = m.status === 'pending'
                const bal      = net[m.id] ?? 0
                const balColor = Math.abs(bal) < 0.01 ? T.inkFaint : bal > 0 ? T.mintInk : T.coralInk
                const balStr   = formatAmount(bal, { sign: true })
                const caption  = isYou ? 'your net' : Math.abs(bal) < 0.01 ? 'settled' : bal > 0 ? 'is owed' : 'owes the group'
                const rowStyle: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 8px', borderRadius: T.r.md, border: 0, background: 'transparent', font: 'inherit', textAlign: 'left' }
                const rowContent = (
                  <>
                    <Avatar profile={avatarProfile(m)} slot={slotFor(members, m.id)} size={32} isYou={isYou} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: pending ? T.inkMuted : T.ink, lineHeight: 1.2 }}>{isYou ? 'You' : firstName(name)}</div>
                      <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{pending ? '⏳ invited' : caption}</div>
                    </div>
                    {!pending && (
                      <div style={{ fontFamily: FH, fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: balColor }}>
                        {balStr}
                      </div>
                    )}
                  </>
                )
                if (pending) {
                  return <div key={m.id} style={rowStyle}>{rowContent}</div>
                }
                return (
                  <button
                    key={m.id}
                    onClick={() => { if (isYou) { setSettleUser(null); setSettleOpen(true) } else { setViewingMemberId(m.id) } }}
                    style={{ ...rowStyle, cursor: 'pointer' }}
                  >
                    {rowContent}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Who's ahead? — desktop placement, bottom of the Members column ── */}
          <div className="group-detail-whos-ahead--desktop" style={{ marginTop: 16 }}>
            <WhosAheadRow entries={leaderboard} members={members} myId={myId} onOpen={() => setLeaderboardOpen(true)} />
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
              <Card tone="surface" className="group-detail-empty-members" style={{ width: '100%', borderRadius: T.r.lg, overflow: 'hidden', marginTop: 16 }}>
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
              </Card>
            </div>

          ) : (

            /* ══ POPULATED STATE ══ */
            <>

              {/* ── Balance hero — fixed height regardless of balance count; tap
                   always opens SettleUpSheet (which has its own "All settled
                   up." state, so this works even when myBal is zero) ── */}
              <button
                onClick={() => { setSettleUser(null); setSettleOpen(true) }}
                className="group-detail-balance-card"
                style={{ width: '100%', marginBottom: 20, display: 'flex', alignItems: 'center', background: T.surface, border: `0.5px solid ${T.line}`, boxShadow: T.shadowSm, borderRadius: T.r.lg, cursor: 'pointer', font: 'inherit', textAlign: 'left', padding: '16px' }}
              >
                <div style={{ flex: 1 }}>
                  <SectionLabel size="sm" style={{ marginBottom: 7 }}>
                    {Math.abs(myBal) < 0.01 ? 'All square' : netPositive ? 'Owed to you' : 'You owe'}
                  </SectionLabel>
                  <div style={{ fontFamily: FH, fontSize: 30, fontWeight: 600, letterSpacing: -0.9, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: Math.abs(myBal) < 0.01 ? T.inkFaint : netPositive ? T.mintInk : T.coralInk }}>
                    {Math.abs(myBal) < 0.01 ? '—' : formatAmount(myBal)}
                  </div>
                  {hasBalance && (
                    <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 5, fontWeight: 500 }}>
                      {netPositive
                        ? `from ${oweMeEntries.length} ${oweMeEntries.length === 1 ? 'person' : 'people'}`
                        : `to ${IOweEntries.length} ${IOweEntries.length === 1 ? 'person' : 'people'}`}
                    </div>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                  <path d="M3.5 6l4.5 4.5 4.5-4.5" stroke={T.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* ── Who's ahead? — mobile placement, below the hero ── */}
              <div className="group-detail-whos-ahead--mobile" style={{ marginBottom: 20 }}>
                <WhosAheadRow entries={leaderboard} members={members} myId={myId} onOpen={() => setLeaderboardOpen(true)} />
              </div>

              {/* ── Expense + settlement feed ──
                   A stack of FeedCards rather than hairline rows in one card:
                   once a row can grow a trailing reaction line, a hairline is
                   doing too much work to say those pills belong to the expense
                   above rather than the one below. Gaps say it unambiguously.
                   Same component the Activity tab renders, one size up. ── */}
              {dateOrder.map(date => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <SectionLabel style={{ padding: '0 4px 9px' }}>{date}</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {byDate[date].map(item => {
                      const model = toGroupFeedCard(item, members, myId)

                      if (item.type === 'expense') {
                        return (
                          <FeedCard
                            key={model.id}
                            className="feed-card-row"
                            model={{ ...model, onClick: () => setExpenseSheet(item.data) }}
                            footer={
                              <div style={{ marginTop: 10 }}>
                                <ReactionPills
                                  expenseId={item.data.id}
                                  groupId={groupId}
                                  mySeatId={myId}
                                  canPost={myMember?.status === 'active'}
                                  size="row"
                                />
                              </div>
                            }
                          />
                        )
                      }

                      return <FeedCard key={model.id} model={model} />
                    })}
                  </div>
                </div>
              ))}

            </>
          )}
        </div>
      </div>

      <AddExpenseSheet
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        groupId={groupId}
      />

      <SettleUpSheet
        open={settleOpen}
        onClose={() => { setSettleOpen(false); setSettleUser(null) }}
        groupId={groupId}
        mySeatId={myId ?? ''}
        transfers={transfers}
        preselect={preselectTransfer}
      />

      <LeaderboardSheet
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        entries={leaderboard}
        members={members}
        myId={myId}
      />

      <MemberBalancesModal
        open={!!viewingMemberId}
        onClose={() => setViewingMemberId(null)}
        subjectName={viewingMember ? firstName(displayName(viewingMember)) : ''}
        transfers={viewingTransfers}
      />

      {/* ── Sheets ── */}
      <ExpenseActionSheet
        expense={expenseSheet}
        members={members}
        groupId={groupId}
        mySeatId={myId}
        canPost={myMember?.status === 'active'}
        onClose={() => setExpenseSheet(null)}
      />

    </div>
  )
}
