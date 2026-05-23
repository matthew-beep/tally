'use client'

import { useParams, useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import {
  INITIAL_GROUPS, PEOPLE, computeGroupBalances, simplifyGroupDebts,
  type PersonKey, type MockGroup,
} from '@/lib/mockData'

function Avi({ person, size = 36, border = false }: { person: PersonKey; size?: number; border?: boolean }) {
  const p = PEOPLE[person]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: p.color, color: p.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.33), fontWeight: 700, fontFamily: F,
      flexShrink: 0, letterSpacing: -0.5,
      boxShadow: border ? `0 0 0 2px ${T.bg}` : undefined,
    }}>
      {p.initials}
    </div>
  )
}

function GroupDetailView({ group }: { group: MockGroup }) {
  const router = useRouter()
  const net = computeGroupBalances(group)
  const debts = simplifyGroupDebts(group)
  const myBal = net['you'] ?? 0
  const isPos = myBal >= 0
  const allSettled = Math.abs(myBal) < 0.01

  const whole = Math.floor(Math.abs(myBal))
  const cents = (Math.abs(myBal) % 1).toFixed(2).slice(1)
  const sign  = allSettled ? '' : isPos ? '+' : '−'

  // Group expenses by date label
  const byDate: Record<string, typeof group.expenses> = {}
  for (const e of [...group.expenses].reverse()) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      height: '100%',
      overflowY: 'auto',
      padding: '28px',
      fontFamily: F,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px 6px 0',
            fontSize: 20, color: T.inkMuted, fontFamily: F,
          }}
        >
          ←
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: 17, color: T.inkMuted }}>🔍</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: 17, color: T.inkMuted }}>···</button>
        </div>
      </div>

      {/* Group header */}
      <div style={{ padding: '8px 20px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: T.r.lg,
          background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, boxShadow: T.shadowSm, flexShrink: 0,
        }}>
          {group.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, color: T.ink }}>{group.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, gap: -6 }}>
            {group.members.map((m, i) => (
              <div key={m} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: group.members.length - i }}>
                <Avi person={m} size={24} border />
              </div>
            ))}
            <span style={{ marginLeft: 10, fontSize: 12, color: T.inkMuted }}>{group.members.length} people</span>
          </div>
        </div>
      </div>

      {/* Balance hero */}
      <div style={{
        margin: '0 16px', padding: '22px 20px',
        background: T.surface, borderRadius: T.r.xl, boxShadow: T.shadowSm,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 8 }}>
          Your balance
        </div>
        {/* §15 number anatomy: sign+$ at 32/0.7, amount at 72 Bricolage, cents at 18 mono */}
        <div style={{
          lineHeight: 1, marginBottom: 4,
          color: allSettled ? T.mintInk : isPos ? T.mintInk : T.coralInk,
        }}>
          <span style={{ fontFamily: FH, fontSize: 32, fontWeight: 500, opacity: 0.7 }}>{sign}$</span>
          <span style={{ fontFamily: FH, fontSize: 72, fontWeight: 700, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>{whole}</span>
          <span style={{ fontFamily: FMONO, fontSize: 18, color: allSettled ? T.mintInk : isPos ? T.mintInk : T.coralInk, opacity: 0.7 }}>{cents}</span>
        </div>
        <div style={{ fontSize: 13, color: T.inkMuted }}>
          {allSettled
            ? 'You\'re all settled up in this group 🎉'
            : isPos
              ? 'Overall you are owed in this group'
              : 'Overall you owe in this group'}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {!allSettled && (
            <button style={{
              flex: 1, padding: '11px 0', background: T.ink,
              color: T.bg, border: 'none', borderRadius: T.r.md,
              fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer',
            }}>
              Settle up
            </button>
          )}
          <button
            onClick={() => router.push(`/groups/${group.id}/add`)}
            style={{
              flex: 1, padding: '11px 0',
              background: allSettled ? T.ink : T.surface,
              color: allSettled ? T.bg : T.ink,
              border: allSettled ? 'none' : `1.5px solid ${T.lineStrong}`,
              borderRadius: T.r.md,
              fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer',
            }}
          >
            + Add expense
          </button>
        </div>
      </div>

      {/* Simplified debts */}
      {debts.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 8 }}>
            Who pays who
          </div>
          <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: T.shadowSm }}>
            {debts.map((debt, i) => {
              const isMyDebt = debt.from === 'you'
              const isOwedToMe = debt.to === 'you'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '13px 16px',
                    borderBottom: i < debts.length - 1 ? `1px solid ${T.line}` : 'none',
                  }}
                >
                  <Avi person={debt.from} size={32} />
                  <div style={{
                    margin: '0 10px', width: 24, height: 24,
                    background: T.bg, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, flexShrink: 0,
                  }}>→</div>
                  <Avi person={debt.to} size={32} />
                  <div style={{ flex: 1, marginLeft: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {PEOPLE[debt.from].name} → {PEOPLE[debt.to].name}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>
                      ${debt.amount.toFixed(2)}
                    </div>
                  </div>
                  {isMyDebt && (
                    <button style={{
                      padding: '6px 14px', background: T.ink, color: T.bg,
                      border: 'none', borderRadius: T.r.pill,
                      fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                    }}>Pay</button>
                  )}
                  {isOwedToMe && (
                    <button style={{
                      padding: '6px 14px', background: T.surface, color: T.inkMuted,
                      border: `1px solid ${T.lineStrong}`, borderRadius: T.r.pill,
                      fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                    }}>Remind</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Activity feed grouped by date */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 12 }}>
          Activity
        </div>
        {Object.entries(byDate).map(([date, expenses]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.inkFaint, marginBottom: 6, paddingLeft: 2 }}>{date}</div>
            <div style={{ background: T.surface, borderRadius: T.r.lg, overflow: 'hidden', boxShadow: T.shadowSm }}>
              {expenses.map((expense, i) => {
                const payer = PEOPLE[expense.paidBy]
                const perPerson = expense.amount / expense.splitAmong.length
                const youPaid = expense.paidBy === 'you'
                const youIn = expense.splitAmong.includes('you')
                const myAmt = youPaid
                  ? (expense.splitAmong.length - (expense.splitAmong.includes('you') ? 1 : 0)) * perPerson
                  : youIn ? perPerson : 0
                const myAmtSign = youPaid ? 1 : -1

                return (
                  <div key={expense.id} style={{
                    display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12,
                    borderBottom: i < expenses.length - 1 ? `1px solid ${T.line}` : 'none',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: T.r.md,
                      background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, flexShrink: 0,
                    }}>
                      {expense.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {expense.desc}
                      </div>
                      <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>
                        {payer.name} paid · {expense.splitAmong.length} people
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FMONO, color: T.ink }}>
                        ${expense.amount.toFixed(2)}
                      </div>
                      {(youPaid || youIn) && myAmt > 0 && (
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: myAmtSign > 0 ? T.mintInk : T.coralInk,
                          marginTop: 1,
                        }}>
                          {myAmtSign > 0 ? '+' : '−'}${myAmt.toFixed(2)}
                        </div>
                      )}
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

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()

  const group = INITIAL_GROUPS.find(g => g.id === groupId)

  if (!group) {
    return (
      <div style={{
        padding: '28px',
        fontFamily: F, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300,
      }}>
        <div style={{ fontSize: 40 }}>💸</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>Group not found</div>
        <button
          onClick={() => router.push('/')}
          style={{
            marginTop: 4, padding: '10px 20px', background: T.ink, color: T.bg,
            border: 'none', borderRadius: T.r.md, fontSize: 14, fontWeight: 600,
            fontFamily: F, cursor: 'pointer',
          }}
        >
          Go home
        </button>
      </div>
    )
  }

  return <GroupDetailView group={group} />
}
