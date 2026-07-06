'use client'

import { T, FH, F } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements, useCreateSettlement } from '@/queries/useSettlements'
import { useCurrentProfile } from '@/queries/useProfile'
import { calcNetBalances, simplifyDebts } from '@/lib/balance'
import { avatarProfile, displayName } from '@/lib/memberDisplay'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { GroupMember } from '@/types'

const TILE_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
  textTransform: 'uppercase', color: T.inkMuted,
}

export default function SettleUpPage() {
  const params  = useParams()
  const groupId = params.id as string
  const router  = useRouter()

  const { data: group }          = useGroup(groupId)
  const { data: members = [] }   = useGroupMembers(groupId)
  const { data: expenses = [] }  = useExpenses(groupId)
  const { data: settlements = [] } = useSettlements(groupId)
  const { data: profile }        = useCurrentProfile()
  const createSettlement         = useCreateSettlement(groupId)

  const memberIds  = members.map(m => m.id)
  const net        = calcNetBalances(groupId, expenses, settlements, memberIds)
  const simplified = simplifyDebts(net)
  const memberById = Object.fromEntries(members.map(m => [m.id, m as GroupMember]))
  const myMember   = members.find(m => m.user_id === profile?.id)

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount,      setAmount]      = useState('')
  const [note,        setNote]        = useState('')
  const [settledDate, setSettledDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!simplified.length) return
    const myIdx = myMember
      ? simplified.findIndex(t => t.from === myMember.id || t.to === myMember.id)
      : -1
    const idx = myIdx >= 0 ? myIdx : 0
    setSelectedIdx(idx)
    setAmount(simplified[idx].amount.toFixed(2))
  }, [myMember?.id, simplified.length])

  function slotFor(id: string): 0 | 1 | 2 | 3 {
    return Math.max(0, members.findIndex(m => m.id === id)) % 4 as 0 | 1 | 2 | 3
  }

  async function handleRecord() {
    const t = simplified[selectedIdx]
    if (!t) return
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return
    await createSettlement.mutateAsync({
      from_member_id: t.from,
      to_member_id:   t.to,
      amount:         Math.round(amt * 100) / 100,
      note:           note || undefined,
      settled_date:   settledDate,
    })
    router.push(`/groups/${groupId}`)
  }

  const transfer = simplified[selectedIdx]
  const canSave  = !!transfer && parseFloat(amount) > 0 && !createSettlement.isPending
  const groupLabel = group ? `${group.emoji} ${group.name}` : '…'

  // Empty state — all settled up
  if (!simplified.length) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>All settled up!</div>
        <div style={{ fontSize: 14, color: T.inkMuted, textAlign: 'center' }}>No outstanding balances in this group.</div>
        <button
          onClick={() => router.back()}
          style={{ marginTop: 8, padding: '12px 28px', borderRadius: 14, background: T.ink, color: T.bg, border: 'none', cursor: 'pointer', fontFamily: FH, fontSize: 15, fontWeight: 600 }}
        >Go back</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Safe area */}
        <div style={{ height: 52, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '0 20px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 12, background: T.surface, border: `0.5px solid ${T.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke={T.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkMuted }}>{groupLabel}</div>
            <div style={{ fontFamily: FH, fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: T.ink, marginTop: 1 }}>Settle up</div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

          {/* Transfer list — all outstanding transfers, tap to select */}
          <div style={{ background: T.surface, borderRadius: 18, border: `0.5px solid ${T.line}`, overflow: 'hidden', marginBottom: 12 }}>
            {simplified.map((t, idx) => {
              const from = memberById[t.from]
              const to   = memberById[t.to]
              const sel  = idx === selectedIdx
              const involvesMeFrom = myMember && t.from === myMember.id
              const involvesMeTo   = myMember && t.to === myMember.id
              const meLabel = involvesMeFrom ? 'You pay' : involvesMeTo ? 'You receive' : null

              return (
                <div
                  key={idx}
                  onClick={() => { setSelectedIdx(idx); setAmount(t.amount.toFixed(2)) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderTop: idx === 0 ? 'none' : `0.5px solid ${T.line}`,
                    background: sel ? T.sunSoft : 'transparent',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                >
                  {/* From */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 48 }}>
                    <Avatar profile={from ? avatarProfile(from) : undefined} slot={slotFor(t.from)} size={38} isYou={from?.user_id === profile?.id} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.ink, textAlign: 'center', lineHeight: 1.1 }}>
                      {from ? displayName(from).split(' ')[0] : '…'}
                    </div>
                  </div>

                  {/* Arrow + amount */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: sel ? T.sunInk : T.ink }}>
                      ${t.amount.toFixed(2)}
                    </div>
                    <svg width={32} height={10} viewBox="0 0 32 10" fill="none">
                      <path d="M2 5h24M20 1l6 4-6 4" stroke={sel ? T.sun : T.lineStrong} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {meLabel && (
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: sel ? T.sunInk : T.inkFaint }}>
                        {meLabel}
                      </div>
                    )}
                  </div>

                  {/* To */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 48 }}>
                    <Avatar profile={to ? avatarProfile(to) : undefined} slot={slotFor(t.to)} size={38} isYou={to?.user_id === profile?.id} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.ink, textAlign: 'center', lineHeight: 1.1 }}>
                      {to ? displayName(to).split(' ')[0] : '…'}
                    </div>
                  </div>

                  {/* Selection dot */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: sel ? T.sun : 'transparent',
                    border: `1.5px solid ${sel ? T.sun : T.lineStrong}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: T.sunInk,
                  }}>{sel ? '✓' : ''}</div>
                </div>
              )
            })}
          </div>

          {/* Amount */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '14px 16px', marginBottom: 10 }}>
            <div style={TILE_LABEL}>Amount</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
              <span style={{ fontFamily: FH, fontSize: 24, fontWeight: 500, color: T.inkMuted }}>$</span>
              <input
                type="number" inputMode="decimal" min={0}
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/-/g, ''))}
                placeholder="0.00"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FH, fontSize: 38, fontWeight: 700, letterSpacing: -1.4, color: T.ink }}
              />
            </div>
          </div>

          {/* Note */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Note (optional)</div>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Venmo, cash, Zelle…"
              style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: 15, fontFamily: F, color: T.ink, caretColor: T.sun }}
            />
          </div>

          {/* Date */}
          <div style={{ background: T.surface, borderRadius: 16, border: `0.5px solid ${T.line}`, padding: '12px 14px', marginBottom: 24 }}>
            <div style={{ ...TILE_LABEL, marginBottom: 8 }}>Payment date</div>
            <input
              type="date"
              value={settledDate}
              onChange={e => setSettledDate(e.target.value)}
              style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: F, color: T.ink }}
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{ flexShrink: 0, padding: '8px 20px 40px', background: `linear-gradient(to top, ${T.bg} 80%, transparent)` }}>
          <div style={{ background: T.sunSoft, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: T.sunInk, fontWeight: 600 }}>
            ⏳ Creates a pending settlement — the payee will be asked to confirm.
          </div>
          <button
            onClick={handleRecord}
            disabled={!canSave}
            style={{
              width: '100%', padding: '17px', borderRadius: 14, border: 'none',
              background: canSave ? T.sun : T.lineStrong,
              color: canSave ? T.sunInk : T.inkFaint,
              fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.2,
              cursor: canSave ? 'pointer' : 'default',
              boxShadow: canSave ? '0 4px 16px rgba(242,192,74,0.28)' : 'none',
            }}
          >{createSettlement.isPending ? 'Recording…' : 'Record payment'}</button>
        </div>
      </div>
    </div>
  )
}
