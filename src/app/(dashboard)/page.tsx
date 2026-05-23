'use client'

import { useRouter } from 'next/navigation'
import { T, F, FH, FMONO } from '@/design/tokens'
import {
  INITIAL_GROUPS, PEOPLE, computeGlobalBalances, computeGroupBalances,
  type PersonKey, type MockGroup,
} from '@/lib/mockData'

function Avi({ person, size = 32 }: { person: PersonKey; size?: number }) {
  const p = PEOPLE[person]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: p.color, color: p.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.34), fontWeight: 700, fontFamily: F,
      flexShrink: 0, letterSpacing: -0.5,
    }}>
      {p.initials}
    </div>
  )
}

function AmtText({ amount, size = 15 }: { amount: number; size?: number }) {
  const sign   = amount >= 0 ? '+' : '−'
  const abs    = Math.abs(amount)
  const whole  = Math.floor(abs).toLocaleString()
  const cents  = (abs % 1).toFixed(2).slice(1)
  const color  = amount >= 0 ? T.mintInk : T.coralInk
  return (
    <span style={{ fontFamily: FH, fontWeight: 700, fontSize: size, color, letterSpacing: -0.5 }}>
      <span style={{ opacity: 0.6 }}>{sign}$</span>
      {whole}
      <span style={{ fontFamily: FMONO, fontSize: size * 0.72, opacity: 0.7 }}>{cents}</span>
    </span>
  )
}

function TopBar() {
  const router = useRouter()
  return (
    <div style={{
      padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${T.line}`,
      position: 'sticky', top: 0, zIndex: 10, background: T.bg,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Home</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, color: T.ink, marginTop: 1 }}>
          Good morning ☀️
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={{
          background: T.bg, border: 'none', borderRadius: T.r.md, padding: '7px 14px',
          fontSize: 13, fontWeight: 500, color: T.inkMuted, fontFamily: F, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🔍 Search
        </button>
        <button
          onClick={() => router.push('/groups/new')}
          style={{
            background: T.ink, border: 'none', borderRadius: T.r.md, padding: '7px 16px',
            fontSize: 13, fontWeight: 600, color: T.bg, fontFamily: F, cursor: 'pointer',
          }}
        >
          + Add
        </button>
        <Avi person="you" size={34} />
      </div>
    </div>
  )
}

function HeroRow() {
  const { total, owedToYou, youOwe } = computeGlobalBalances()
  const isPositive = total >= 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
      {/* Net balance card */}
      <div style={{
        background: T.surface, borderRadius: T.r.xl, padding: '22px 22px 20px',
        boxShadow: T.shadowSm, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 120, height: 120, borderRadius: '50%',
          background: isPositive ? T.mintSoft : T.coralSoft,
          opacity: 0.6,
        }} />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 10 }}>
          Net balance
        </div>
        {/* §15 anatomy at dashboard scale: sign+$ 22px/0.7, amount 44px, cents 13px mono */}
        <div style={{ lineHeight: 1, marginBottom: 6, color: isPositive ? T.mintInk : T.coralInk }}>
          <span style={{ fontFamily: FH, fontSize: 22, fontWeight: 500, opacity: 0.7 }}>{isPositive ? '+' : '−'}$</span>
          <span style={{ fontFamily: FH, fontSize: 44, fontWeight: 700, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(Math.abs(total)).toLocaleString()}
          </span>
          <span style={{ fontFamily: FMONO, fontSize: 13, opacity: 0.7 }}>
            {(Math.abs(total) % 1).toFixed(2).slice(1)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted }}>
          {isPositive ? 'Overall you are owed' : 'Overall you owe'} across all groups
        </div>
      </div>

      {/* Owed to you */}
      <div style={{ background: T.surface, borderRadius: T.r.lg, padding: '20px 20px 16px', boxShadow: T.shadowSm }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.mintInk, marginBottom: 12 }}>
          Owed to you
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {owedToYou.map(({ person, amount }) => (
            <div key={person} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avi person={person} size={28} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.ink }}>{PEOPLE[person].name}</span>
              <AmtText amount={amount} size={14} />
            </div>
          ))}
          {owedToYou.length === 0 && <div style={{ fontSize: 13, color: T.inkFaint }}>Nothing owed to you</div>}
        </div>
      </div>

      {/* You owe */}
      <div style={{ background: T.surface, borderRadius: T.r.lg, padding: '20px 20px 16px', boxShadow: T.shadowSm }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.coralInk, marginBottom: 12 }}>
          You owe
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {youOwe.map(({ person, amount }) => (
            <div key={person} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avi person={person} size={28} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.ink }}>{PEOPLE[person].name}</span>
              <AmtText amount={-amount} size={14} />
            </div>
          ))}
          {youOwe.length === 0 && <div style={{ fontSize: 13, color: T.inkFaint }}>You owe nothing</div>}
        </div>
      </div>
    </div>
  )
}

function GroupCard({ group }: { group: MockGroup }) {
  const router = useRouter()
  const net = computeGroupBalances(group)
  const myBal = net['you'] ?? 0
  const isPos = myBal >= 0

  return (
    <div
      onClick={() => router.push(`/groups/${group.id}`)}
      style={{
        background: T.surface, borderRadius: T.r.lg, padding: '16px 18px',
        boxShadow: T.shadowSm, cursor: 'pointer', transition: 'transform 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: T.r.md, background: T.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{group.emoji}</div>
        <div style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: T.r.pill,
          background: Math.abs(myBal) < 0.01 ? T.surfaceAlt : isPos ? T.mintSoft : T.coralSoft,
          color: Math.abs(myBal) < 0.01 ? T.inkMuted : isPos ? T.mintInk : T.coralInk,
        }}>
          {Math.abs(myBal) < 0.01 ? 'Settled' : (isPos ? '+' : '−') + '$' + Math.abs(myBal).toFixed(2)}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH, color: T.ink, marginBottom: 3 }}>{group.name}</div>
      <div style={{ fontSize: 12, color: T.inkMuted }}>
        {group.members.length} people · {group.expenses.length} expenses
      </div>

      {/* Member stack */}
      <div style={{ display: 'flex', marginTop: 12, paddingLeft: 2 }}>
        {group.members.slice(0, 4).map((m, i) => (
          <div key={m} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: group.members.length - i }}>
            <Avi person={m} size={22} />
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupsPanel() {
  return (
    <div style={{ flex: '0 0 60%', minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted, marginBottom: 12 }}>
        Groups
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {INITIAL_GROUPS.map(group => (
          <GroupCard key={group.id} group={group} />
        ))}
        {/* Quick split tile */}
        <div style={{
          borderRadius: T.r.lg, padding: '16px 18px',
          border: `2px dashed ${T.lineStrong}`, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, minHeight: 120,
          color: T.inkMuted,
        }}>
          <div style={{ fontSize: 26, opacity: 0.5 }}>⚡</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Quick Split</div>
          <div style={{ fontSize: 11, color: T.inkFaint, textAlign: 'center' }}>Split a bill without a group</div>
        </div>
      </div>
    </div>
  )
}

function ActivityPanel() {
  const allExpenses = INITIAL_GROUPS.flatMap(group =>
    group.expenses.map(e => ({ ...e, groupName: group.name, groupEmoji: group.emoji }))
  ).slice(0, 10)

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.inkMuted, marginBottom: 12 }}>
        Recent activity
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {allExpenses.map(e => {
          const perPerson = e.amount / e.splitAmong.length
          const youInvolved = e.splitAmong.includes('you') || e.paidBy === 'you'
          if (!youInvolved) return null

          const payer = PEOPLE[e.paidBy]
          const youPaid = e.paidBy === 'you'
          const youOweAmt = !youPaid && e.splitAmong.includes('you') ? perPerson : 0
          const youGetAmt = youPaid ? (e.splitAmong.length - 1) * perPerson : 0

          return (
            <div key={e.id} style={{
              background: T.surface, borderRadius: T.r.md, padding: '11px 14px',
              display: 'flex', gap: 10, alignItems: 'center',
              boxShadow: T.shadowSm,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: T.r.sm,
                background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>{e.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.desc}</div>
                <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>
                  {payer.name} · {e.groupEmoji} {e.groupName}
                </div>
              </div>
              {(youOweAmt > 0 || youGetAmt > 0) && (
                <div style={{
                  fontSize: 13, fontWeight: 700, fontFamily: FH, letterSpacing: -0.3,
                  color: youGetAmt > 0 ? T.mintInk : T.coralInk, flexShrink: 0,
                }}>
                  {youGetAmt > 0 ? '+' : '−'}${(youGetAmt || youOweAmt).toFixed(2)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <TopBar />
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        padding: '24px 28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <HeroRow />
        <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
          <GroupsPanel />
          <ActivityPanel />
        </div>
      </div>
    </div>
  )
}
