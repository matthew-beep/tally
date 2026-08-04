'use client'

import { useState, useEffect, useRef } from 'react'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useAddExpense } from '@/queries/useExpenses'
import { useCurrentProfile } from '@/queries/useProfile'
import { detectCategory } from '@/lib/categories'
import { makeEqualSplits, makePercentSplits, makeExactSplits } from '@/lib/splits'
import { round2, parseNum } from '@/lib/money'
import { slotFor } from '@/lib/memberDisplay'
import type { GroupMember } from '@/types'
import type { SplitMode, LineItem } from './types'

/**
 * Even shares that sum *exactly* to the total. Naive `total / n` rounded per row
 * leaves a stray cent (or 0.1%) on odd divisions, which would open percent/exact
 * mode already out of balance and block Save with no field obviously at fault.
 * The leftover goes to the first row, matching lib/splits.ts.
 */
export function evenShares(total: number, n: number, decimals: 1 | 2): string[] {
  const f = 10 ** decimals
  const base = Math.floor((total / n) * f) / f
  const leftover = Math.round((total - base * n) * f) / f
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + leftover : base).toFixed(decimals))
}

export interface AddExpenseFormState {
  group: ReturnType<typeof useGroup>['data']
  groupLabel: string
  members: GroupMember[]
  memberIds: string[]
  memberById: Record<string, GroupMember>
  slotById: Record<string, 0 | 1 | 2 | 3>
  youMemberId: string | undefined

  amount: string
  setAmount: (v: string) => void
  amt: number
  description: string
  setDescription: (v: string) => void
  category: string
  selectCategory: (emoji: string) => void
  expenseDate: string
  setExpenseDate: (v: string) => void
  splitMode: SplitMode
  setSplitMode: (m: SplitMode) => void
  paidById: string | null
  setPaidById: (id: string) => void

  included: Set<string>
  toggleIncluded: (id: string) => void
  percents: Record<string, string>
  setPercent: (id: string, v: string) => void
  exactAmounts: Record<string, string>
  setExactAmount: (id: string, v: string) => void

  /** Rows that own an editable input, and whose values must balance. */
  amountsIds: string[]
  percentValid: boolean
  exactValid: boolean
  /** Signed shortfall: positive = still to assign, negative = over. */
  percentRemaining: number
  exactRemaining: number

  focusId: string | null
  setFocusId: (id: string | null) => void
  openPanel: 'payer' | 'split' | null
  setOpenPanel: (p: 'payer' | 'split' | null) => void

  items: LineItem[]
  addItem: () => void
  removeItem: (id: number) => void
  renameItem: (id: number, name: string) => void
  priceItem: (id: number, price: number) => void
  toggleAssign: (id: number, memberId: string) => void
  taxMode: 'percent' | 'flat'
  setTaxMode: (m: 'percent' | 'flat') => void
  taxVal: number
  setTaxVal: (v: number) => void
  tipMode: 'percent' | 'flat'
  setTipMode: (m: 'percent' | 'flat') => void
  tipVal: number
  setTipVal: (v: number) => void
  subtotal: number
  taxAmt: number
  tipAmt: number
  itemTotal: number

  canSave: boolean
  saveLabel: string
  isPending: boolean
  handleSave: () => Promise<void>
}

/**
 * All add-expense state and math, shared by the mobile and desktop layouts.
 *
 * The one thing that genuinely differs between them is who owns an editable
 * amount in percent/exact mode:
 *   Mobile — every member except the payer; the payer's share is the remainder.
 *   Desktop — every member, payer included; the whole list must balance.
 * That difference is captured once, in `amountsIds`, and everything downstream
 * (the remainder counter, `canSave`, and the saved splits) reads from it — so
 * the footer can never claim "balanced" while Save disagrees.
 */
export function useAddExpenseForm({ groupId, isMobile, onSuccess }: {
  groupId: string
  isMobile: boolean
  onSuccess: () => void
}): AddExpenseFormState {
  const { data: group }        = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const { data: profile }      = useCurrentProfile()
  const addExpense             = useAddExpense(groupId)

  const [amount,         setAmount]         = useState('')
  const [description,    setDescription]    = useState('')
  const [category,       setCategory]       = useState('💸')
  const [manualCategory, setManualCategory] = useState(false)
  const [splitMode,      setSplitMode]      = useState<SplitMode>('equal')
  const [paidById,       setPaidById]       = useState<string | null>(null)
  const [expenseDate,    setExpenseDate]    = useState(new Date().toISOString().split('T')[0])
  const [included,       setIncluded]       = useState<Set<string>>(new Set())
  const [percents,       setPercents]       = useState<Record<string, string>>({})
  const [exactAmounts,   setExactAmounts]   = useState<Record<string, string>>({})
  const [focusId,        setFocusId]        = useState<string | null>(null)
  const [openPanel,      setOpenPanel]      = useState<'payer' | 'split' | null>(null)

  // Once the user edits a field by hand we stop re-deriving even shares for
  // that mode — their numbers are intent, not a placeholder.
  const [percentTouched, setPercentTouched] = useState(false)
  const [exactTouched,   setExactTouched]   = useState(false)

  // Itemized builder state — UI-only preview, nothing reaches handleSave
  const [items,    setItems]    = useState<LineItem[]>([])
  const [taxMode,  setTaxMode]  = useState<'percent' | 'flat'>('percent')
  const [taxVal,   setTaxVal]   = useState(0)
  const [tipMode,  setTipMode]  = useState<'percent' | 'flat'>('percent')
  const [tipVal,   setTipVal]   = useState(0)
  const nextItemId = useRef(0)

  const typedMembers = members as GroupMember[]
  const memberIds   = typedMembers.map(m => m.id)
  const memberById  = Object.fromEntries(typedMembers.map(m => [m.id, m]))
  const slotById    = Object.fromEntries(typedMembers.map(m => [m.id, slotFor(typedMembers, m.id)]))
  const myMember    = typedMembers.find(m => m.user_id === profile?.id)
  const youMemberId = myMember?.id

  const amt = parseNum(amount)

  useEffect(() => {
    if (myMember && !paidById) setPaidById(myMember.id)
  }, [myMember?.id])

  // Default to everyone, and drop anyone who is no longer a member.
  const membersKey = memberIds.join(',')
  useEffect(() => {
    if (memberIds.length === 0) return
    setIncluded(prev => {
      if (prev.size === 0) return new Set(memberIds)
      const stale = [...prev].filter(id => !memberById[id])
      if (stale.length === 0) return prev
      const next = new Set(prev)
      stale.forEach(id => next.delete(id))
      return next
    })
  }, [membersKey])

  // Payer can never be excluded from their own expense
  useEffect(() => {
    if (!paidById) return
    setIncluded(prev => prev.has(paidById) ? prev : new Set(prev).add(paidById))
  }, [paidById])

  useEffect(() => {
    if (!manualCategory && description) setCategory(detectCategory(description))
  }, [description, manualCategory])

  // Mobile leaves the payer's share implicit; desktop makes everyone balance.
  const amountsIds = isMobile && paidById
    ? memberIds.filter(id => included.has(id) && id !== paidById)
    : memberIds.filter(id => included.has(id))

  const percentSum = amountsIds.reduce((a, id) => a + parseNum(percents[id]), 0)
  const exactSum   = amountsIds.reduce((a, id) => a + parseNum(exactAmounts[id]), 0)
  const percentRemaining = round2(100 - percentSum)
  const exactRemaining   = round2(amt - exactSum)
  const percentValid = amountsIds.length > 0 && Math.abs(percentRemaining) < 0.005
  const exactValid   = amt > 0 && amountsIds.length > 0 && Math.abs(exactRemaining) < 0.005

  // Seed percent/exact inputs with an even split, and keep re-seeding as the
  // amount or the member set changes until the user takes over. Without the
  // re-seed, typing the amount *after* switching to exact mode leaves every
  // field at the old total's share and Save stays permanently blocked.
  const amountsKey = amountsIds.join(',')
  useEffect(() => {
    if (splitMode !== 'exact' && splitMode !== 'percentage') return
    if (amountsIds.length === 0) return

    const isExact  = splitMode === 'exact'
    const touched  = isExact ? exactTouched : percentTouched
    const shares   = isExact
      ? evenShares(amt, amountsIds.length, 2)
      : evenShares(100, amountsIds.length, 1)
    const setValues = isExact ? setExactAmounts : setPercents

    setValues(prev => {
      const next = { ...prev }
      let changed = false
      amountsIds.forEach((id, i) => {
        // Once touched, only fill gaps (a member added mid-edit).
        if (touched && prev[id] !== undefined) return
        if (next[id] === shares[i]) return
        next[id] = shares[i]
        changed = true
      })
      return changed ? next : prev
    })
  }, [splitMode, amt, amountsKey, exactTouched, percentTouched])

  function toggleIncluded(id: string) {
    setIncluded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  function selectCategory(emoji: string) {
    setCategory(emoji)
    setManualCategory(true)
  }

  function setPercent(id: string, v: string) {
    setPercentTouched(true)
    setPercents(p => ({ ...p, [id]: v }))
  }

  function setExactAmount(id: string, v: string) {
    setExactTouched(true)
    setExactAmounts(p => ({ ...p, [id]: v }))
  }

  const subtotal  = items.reduce((s, it) => s + it.price, 0)
  const taxAmt    = taxMode === 'percent' ? round2(subtotal * taxVal / 100) : taxVal
  const tipAmt    = tipMode === 'percent' ? round2(subtotal * tipVal / 100) : tipVal
  const itemTotal = round2(subtotal + taxAmt + tipAmt)

  const baseValid = !!description.trim() && amt > 0 && !!paidById
  const canSave = baseValid && (
    splitMode === 'equal'      ? included.size > 0 :
    splitMode === 'percentage' ? percentValid :
    splitMode === 'exact'      ? exactValid :
    false
  )

  const saveLabel = addExpense.isPending ? 'Saving…' :
    !baseValid                                  ? 'Save expense' :
    splitMode === 'percentage' && !percentValid ? 'Balance to 100% first' :
    splitMode === 'exact'      && !exactValid   ? "Doesn't add up yet" :
    splitMode === 'itemized'                    ? 'Coming soon' :
    'Save expense'

  async function handleSave() {
    if (!canSave || addExpense.isPending || !paidById) return
    const roundedAmt = round2(amt)

    let splits: { group_member_id: string; owed_amount: number }[]
    let splitType: 'equal' | 'percentage' | 'exact'

    if (splitMode === 'equal') {
      splits    = makeEqualSplits('', roundedAmt, [...included], paidById)
      splitType = 'equal'
    } else if (splitMode === 'percentage') {
      // Mobile: the payer takes whatever percentage the others left over.
      const percentInputs = [
        ...(isMobile ? [{
          group_member_id: paidById,
          percent: Math.max(0, round2(100 - percentSum)),
        }] : []),
        ...amountsIds.map(id => ({ group_member_id: id, percent: parseNum(percents[id]) })),
      ]
      splits    = makePercentSplits('', roundedAmt, percentInputs, paidById)
      splitType = 'percentage'
    } else {
      const exactInputs = [
        ...(isMobile ? [{
          group_member_id: paidById,
          owed_amount: Math.max(0, round2(roundedAmt - exactSum)),
        }] : []),
        ...amountsIds.map(id => ({ group_member_id: id, owed_amount: parseNum(exactAmounts[id]) })),
      ]
      splits    = makeExactSplits('', exactInputs, roundedAmt, paidById)
      splitType = 'exact'
    }

    await addExpense.mutateAsync({
      description: description.trim(),
      amount: roundedAmt,
      paid_by: paidById,
      split_type: splitType,
      splits: splits.map(s => ({ group_member_id: s.group_member_id, owed_amount: s.owed_amount })),
      category,
      expense_date: expenseDate,
    })
    onSuccess()
  }

  return {
    group,
    groupLabel: group ? `${group.emoji} ${group.name}` : '…',
    members: typedMembers, memberIds, memberById, slotById, youMemberId,

    amount, setAmount, amt,
    description, setDescription,
    category, selectCategory,
    expenseDate, setExpenseDate,
    splitMode, setSplitMode,
    paidById, setPaidById,

    included, toggleIncluded,
    percents, setPercent,
    exactAmounts, setExactAmount,

    amountsIds, percentValid, exactValid, percentRemaining, exactRemaining,

    focusId, setFocusId, openPanel, setOpenPanel,

    items,
    addItem: () => setItems(prev => [...prev, { id: ++nextItemId.current, name: '', price: 0, assignedTo: [...memberIds] }]),
    removeItem: id => setItems(prev => prev.filter(it => it.id !== id)),
    renameItem: (id, name) => setItems(prev => prev.map(it => it.id === id ? { ...it, name } : it)),
    priceItem: (id, price) => setItems(prev => prev.map(it => it.id === id ? { ...it, price } : it)),
    toggleAssign: (id, memberId) => setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const has = it.assignedTo.includes(memberId)
      return { ...it, assignedTo: has ? it.assignedTo.filter(x => x !== memberId) : [...it.assignedTo, memberId] }
    })),
    taxMode, setTaxMode, taxVal, setTaxVal,
    tipMode, setTipMode, tipVal, setTipVal,
    subtotal, taxAmt, tipAmt, itemTotal,

    canSave, saveLabel, isPending: addExpense.isPending, handleSave,
  }
}
