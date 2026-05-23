'use client'

import { T, FH, F } from '@/design/tokens'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { Card } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useAddExpense } from '@/queries/useExpenses'
import { useCurrentProfile } from '@/queries/useProfile'
import { detectCategory, CATEGORIES } from '@/lib/categories'
import { makeEqualSplits, makeExactSplits } from '@/lib/splits'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import type { Profile } from '@/types'

export default function AddExpensePage() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()

  const { data: group } = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const { data: profile } = useCurrentProfile()
  const addExpense = useAddExpense(groupId)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('💸')
  const [manualCategory, setManualCategory] = useState(false)
  const [splitType, setSplitType] = useState<'equal' | 'exact'>('equal')
  const [paidById, setPaidById] = useState<string | null>(null)
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const profileById = Object.fromEntries(
    members.map(m => [m.user_id, (m as any).profile as Profile])
  )

  useEffect(() => {
    if (profile) setPaidById(profile.id)
  }, [profile?.id])

  useEffect(() => {
    if (!manualCategory && description) {
      setCategory(detectCategory(description))
    }
    if (!description) {
      setManualCategory(false)
      setCategory('💸')
    }
  }, [description, manualCategory])

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!description.trim() || isNaN(amt) || amt <= 0 || !paidById) return

    const memberIds = members.map(m => m.user_id)
    let splits: { user_id: string; owed_amount: number }[]

    if (splitType === 'equal') {
      splits = makeEqualSplits('', amt, memberIds).map(s => ({
        user_id: s.user_id,
        owed_amount: s.owed_amount,
      }))
    } else {
      splits = memberIds.map(id => ({
        user_id: id,
        owed_amount: parseFloat(exactAmounts[id] ?? '0') || 0,
      }))
    }

    await addExpense.mutateAsync({
      description: description.trim(),
      amount: Math.round(amt * 100) / 100,
      paid_by: paidById,
      split_type: splitType,
      splits,
      category,
      expense_date: expenseDate,
    })
    router.push(`/groups/${groupId}`)
  }

  return (
    <DashboardPage>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.inkMuted, padding: 0 }}>←</button>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FH }}>Add expense — {group?.name}</div>
        </div>

        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Category + description */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <button
              onClick={() => setShowCategoryPicker(v => !v)}
              style={{ width: 48, height: 48, borderRadius: T.r.md, background: T.bg, border: `1.5px solid ${T.lineStrong}`, fontSize: 22, cursor: 'pointer', flexShrink: 0 }}
            >
              {category}
            </button>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
              style={{ flex: 1, padding: '12px 14px', borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`, background: T.surfaceAlt, fontSize: 15, fontFamily: F, color: T.ink, outline: 'none' }}
            />
          </div>

          {showCategoryPicker && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px', background: T.bg, borderRadius: T.r.md }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.emoji}
                  onClick={() => { setCategory(cat.emoji); setManualCategory(true); setShowCategoryPicker(false) }}
                  style={{ padding: '8px 12px', borderRadius: T.r.md, background: category === cat.emoji ? T.sunSoft : T.surface, border: `1.5px solid ${category === cat.emoji ? T.sun : T.line}`, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: T.ink }}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          )}

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

          {/* Paid by */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Paid by</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {members.map((m, i) => {
                const p = profileById[m.user_id]
                const name = p ? (p.display_name ?? p.name) : '…'
                const isSelected = paidById === m.user_id
                return (
                  <button
                    key={m.user_id}
                    onClick={() => setPaidById(m.user_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                      borderRadius: T.r.pill, border: `1.5px solid ${isSelected ? T.ink : T.line}`,
                      background: isSelected ? T.ink : T.surface,
                      color: isSelected ? T.bg : T.ink,
                      cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: F,
                    }}
                  >
                    <Avatar profile={p} slot={(i % 4) as 0 | 1 | 2 | 3} size={20} isYou={p?.user_id === profile?.user_id} />
                    {name}
                    {p?.user_id === profile?.user_id && ' (you)'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split type */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Split</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSplitType('equal')}
                style={{ flex: 1, padding: '10px', borderRadius: T.r.md, background: splitType === 'equal' ? T.ink : T.surface, color: splitType === 'equal' ? T.bg : T.ink, border: `1.5px solid ${splitType === 'equal' ? T.ink : T.lineStrong}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: F }}
              >
                Split equally
              </button>
              <button
                onClick={() => setSplitType('exact')}
                style={{ flex: 1, padding: '10px', borderRadius: T.r.md, background: splitType === 'exact' ? T.ink : T.surface, color: splitType === 'exact' ? T.bg : T.ink, border: `1.5px solid ${splitType === 'exact' ? T.ink : T.lineStrong}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: F }}
              >
                Exact amounts
              </button>
            </div>

            {splitType === 'exact' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => {
                  const p = profileById[m.user_id]
                  const name = p ? (p.display_name ?? p.name) : '…'
                  return (
                    <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 13 }}>{name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: T.inkMuted }}>$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={exactAmounts[m.user_id] ?? ''}
                          onChange={e => setExactAmounts(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                          placeholder="0.00"
                          style={{ width: 80, padding: '7px 10px', borderRadius: T.r.sm, border: `1.5px solid ${T.lineStrong}`, background: T.surfaceAlt, fontSize: 14, outline: 'none', fontFamily: F }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Date</div>
            <input
              type="date"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: T.r.md, border: `1.5px solid ${T.lineStrong}`, background: T.surfaceAlt, fontSize: 14, fontFamily: F, color: T.ink, outline: 'none' }}
            />
          </div>

          <Btn
            fullWidth
            size="lg"
            onClick={handleSave}
            disabled={!description.trim() || !amount || parseFloat(amount) <= 0 || !paidById || addExpense.isPending}
          >
            {addExpense.isPending ? 'Saving…' : 'Save expense'}
          </Btn>
        </Card>
    </DashboardPage>
  )
}
