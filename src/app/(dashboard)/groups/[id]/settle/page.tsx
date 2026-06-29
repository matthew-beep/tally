'use client'

import { T, FH, F, FMONO } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useExpenses } from '@/queries/useExpenses'
import { useSettlements, useCreateSettlement } from '@/queries/useSettlements'
import { useCurrentProfile } from '@/queries/useProfile'
import { calcNetBalances, simplifyDebts } from '@/lib/balance'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Profile } from '@/types'

export default function SettleUpPage() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()

  const { data: group } = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const { data: expenses = [] } = useExpenses(groupId)
  const { data: settlements = [] } = useSettlements(groupId)
  const { data: profile } = useCurrentProfile()
  const createSettlement = useCreateSettlement(groupId)

  const memberIds = members.map(m => m.id)
  const net = calcNetBalances(groupId, expenses, settlements, memberIds)
  const simplified = simplifyDebts(net)

  const profileById = Object.fromEntries(
    members.map(m => [m.id, (m as any).profile as Profile])
  )

  const myMember = members.find(m => m.user_id === profile?.id)
  const myTransfer = myMember
    ? simplified.find(t => t.from === myMember.id || t.to === myMember.id)
    : null

  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [settledDate, setSettledDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (myTransfer) {
      setFromUser(myTransfer.from)
      setToUser(myTransfer.to)
      setAmount(myTransfer.amount.toFixed(2))
    } else if (simplified.length > 0) {
      setFromUser(simplified[0].from)
      setToUser(simplified[0].to)
      setAmount(simplified[0].amount.toFixed(2))
    }
  }, [myTransfer?.from, simplified.length])

  async function handleRecord() {
    const amt = parseFloat(amount)
    if (!fromUser || !toUser || isNaN(amt) || amt <= 0) return
    await createSettlement.mutateAsync({ from_member_id: fromUser, to_member_id: toUser, amount: Math.round(amt * 100) / 100, note: note || undefined, settled_date: settledDate })
    router.push(`/groups/${groupId}`)
  }

  const fromProfile = profileById[fromUser]
  const toProfile = profileById[toUser]

  return (
    <DashboardPage>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.inkMuted, padding: 0 }}>←</button>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FH }}>Settle up</div>
        </div>

        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* From → To visual */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '16px', background: T.bg, borderRadius: T.r.md }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Avatar profile={fromProfile} slot={Math.max(0, members.findIndex(m => m.id === fromUser)) % 4 as 0 | 1 | 2 | 3} size={44} isYou={fromProfile?.id === profile?.id} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{fromProfile ? (fromProfile.display_name ?? fromProfile.name) : '…'}</div>
            </div>
            <div style={{ fontSize: 22, color: T.inkFaint }}>→</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Avatar profile={toProfile} slot={Math.max(0, members.findIndex(m => m.id === toUser)) % 4 as 0 | 1 | 2 | 3} size={44} isYou={toProfile?.id === profile?.id} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{toProfile ? (toProfile.display_name ?? toProfile.name) : '…'}</div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Amount</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: T.inkMuted }}>$</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ flex: 1, padding: '12px 14px', borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`, background: T.surfaceAlt, fontSize: 28, fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', fontWeight: 700, color: T.ink, outline: 'none' }}
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Note (optional)</div>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Venmo, cash, etc."
              style={{ width: '100%', padding: '10px 14px', borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`, background: T.surfaceAlt, fontSize: 14, fontFamily: F, color: T.ink, outline: 'none' }}
            />
          </div>

          {/* Date */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Payment date</div>
            <input
              type="date"
              value={settledDate}
              onChange={e => setSettledDate(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`, background: T.surfaceAlt, fontSize: 14, fontFamily: F, color: T.ink, outline: 'none' }}
            />
          </div>

          <div style={{ background: T.sunSoft, borderRadius: T.r.md, padding: '10px 14px', fontSize: 12, color: T.sunInk }}>
            ⏳ This creates a pending settlement. The payee will be asked to confirm it.
          </div>

          <Btn
            fullWidth
            size="lg"
            onClick={handleRecord}
            disabled={!fromUser || !toUser || !amount || parseFloat(amount) <= 0 || createSettlement.isPending}
          >
            {createSettlement.isPending ? 'Recording…' : 'Record payment'}
          </Btn>
        </Card>
    </DashboardPage>
  )
}
