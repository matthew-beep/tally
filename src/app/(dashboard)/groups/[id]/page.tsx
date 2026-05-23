'use client'

import { useParams, useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements } from '@/queries/useSettlements'
import { useCurrentProfile } from '@/queries/useProfile'
import { calcNetBalances, simplifyDebts } from '@/lib/balance'
import type { Profile, Expense, Settlement } from '@/types'

function slotFor(members: { user_id: string }[], id: string): 0 | 1 | 2 | 3 {
  const idx = members.findIndex(m => m.user_id === id)
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

  const { data: group,       isLoading: loadingGroup   } = useGroup(groupId)
  const { data: members = [], isLoading: loadingMembers } = useGroupMembers(groupId)
  const { data: expenses = []                           } = useExpenses(groupId)
  const { data: settlements = []                        } = useSettlements(groupId)
  const { data: profile                                 } = useCurrentProfile()

  const profileById: Record<string, Profile> = Object.fromEntries(
    members.map(m => [m.user_id, (m as any).profile as Profile])
  )

  const memberIds = members.map(m => m.user_id)
  const net       = calcNetBalances(groupId, expenses, settlements, memberIds)
  const debts     = simplifyDebts(net)
  const myId      = profile?.id
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
        <button
          onClick={() => router.push(`/groups/${groupId}/add`)}
          style={{ background: T.ink, color: T.bg, border: 'none', borderRadius: T.r.md, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
        >
          + Add expense
        </button>
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
              <div key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
                <Avatar
                  profile={(m as any).profile}
                  slot={i % 4 as 0 | 1 | 2 | 3}
                  size={24}
                  isYou={(m as any).profile?.user_id === profile?.user_id}
                />
              </div>
            ))}
            <span style={{ marginLeft: 10, fontSize: 12, color: T.inkMuted }}>{members.length} {members.length === 1 ? 'person' : 'people'}</span>
          </div>
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
            onClick={() => router.push(`/groups/${groupId}/add`)}
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
              const fromProfile = profileById[debt.from]
              const toProfile   = profileById[debt.to]
              const isMyDebt    = debt.from === myId
              const owedToMe    = debt.to === myId
              return (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < debts.length - 1 ? `1px solid ${T.line}` : 'none', gap: 10 }}
                >
                  <Avatar profile={fromProfile} slot={slotFor(members, debt.from)} size={32} isYou={fromProfile?.user_id === profile?.user_id} />
                  <div style={{ width: 22, height: 22, background: T.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, color: T.inkMuted }}>→</div>
                  <Avatar profile={toProfile}   slot={slotFor(members, debt.to)}   size={32} isYou={toProfile?.user_id === profile?.user_id} />
                  <div style={{ flex: 1, marginLeft: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {fromProfile?.display_name ?? fromProfile?.name ?? '…'} → {toProfile?.display_name ?? toProfile?.name ?? '…'}
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
                  const payer       = profileById[e.paid_by]
                  const payerName   = payer?.display_name ?? payer?.name ?? '…'
                  const youPaid     = e.paid_by === myId
                  const mySplit     = e.splits?.find(s => s.user_id === myId)
                  const myAmt       = youPaid
                    ? (e.splits ?? []).filter(s => s.user_id !== e.paid_by).reduce((sum, s) => sum + Number(s.owed_amount), 0)
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
                const fromProfile = profileById[s.from_user]
                const toProfile   = profileById[s.to_user]
                const fromName    = fromProfile?.display_name ?? fromProfile?.name ?? '…'
                const toName      = toProfile?.display_name   ?? toProfile?.name   ?? '…'
                const youFrom     = s.from_user === myId
                const youTo       = s.to_user   === myId

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
