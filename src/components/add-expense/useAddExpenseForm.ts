'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useGroup, useGroupMembers } from '@/queries/useGroups'
import { useAddExpense, useUpdateExpense } from '@/queries/useExpenses'
import { useCurrentProfile } from '@/queries/useProfile'
import { insertExpenseComment } from '@/queries/useExpenseComments'
import { detectCategory } from '@/lib/categories'
import { makeEqualSplits, makePercentSplits, makeExactSplits } from '@/lib/splits'
import { round2, parseNum } from '@/lib/money'
import { slotFor } from '@/lib/memberDisplay'
import { localISODate } from '@/lib/time'
import { createClient } from '@/lib/supabase'
import { useUIStore } from '@/store/ui'
import type { Expense, GroupMember } from '@/types'
import type { SplitMode, LineItem, OpenPanel } from './types'
import { seedFromExpense } from './seedFromExpense'

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

/**
 * One member's outcome from the receipt: what they ordered, their proportional
 * cut of tax and tip, and the sum. Members who shared nothing are still
 * present with zeros — the totals drawer lists everyone, so the absence has to
 * be visible rather than implied by a missing row.
 */
export interface ItemShare {
  memberId: string
  subtotal: number
  extra: number
  total: number
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
  note: string
  setNote: (v: string) => void
  category: string
  selectCategory: (emoji: string) => void
  /** True once the user has picked a category, rather than it being auto-detected. */
  manualCategory: boolean
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
  /** Whether the current mode's numbers balance — gates the split sheet's Done. */
  splitValid: boolean
  /** Re-seed the editable rows with an even split. */
  evenOut: () => void
  /**
   * What each member would owe if Save were pressed now, keyed by member id —
   * built by the same lib/splits call handleSave uses, so the stray cent lands
   * where it will actually be saved. Null whenever there is nothing savable to
   * preview: no amount, no payer, an unbalanced split, or itemized.
   */
  previewSplits: Record<string, number> | null

  focusId: string | null
  setFocusId: (id: string | null) => void
  openPanel: OpenPanel
  setOpenPanel: (p: OpenPanel) => void

  items: LineItem[]
  /**
   * Add a line, or replace one being edited. A single entry point because the
   * itemize sheet has a single composer — there is no state in which half a
   * line exists in `items`, so there is nothing for a per-field setter to act
   * on. `id: null` appends.
   */
  upsertItem: (id: number | null, item: Omit<LineItem, 'id'>) => void
  removeItem: (id: number) => void
  /** Tear the receipt up — used when the split mode moves off itemized. */
  clearItems: () => void
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
  /** What each member ends up owing under the current receipt, per member. */
  itemShares: ItemShare[]

  /** Editing a saved expense rather than adding one. */
  isEdit: boolean
  /** Edit mode: whether anything differs from the saved expense. Always true when adding. */
  isDirty: boolean
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
export function useAddExpenseForm({ groupId, isMobile, onSuccess, initial }: {
  groupId: string
  isMobile: boolean
  onSuccess: () => void
  /** Open pre-filled to edit this expense; Save overwrites it. */
  initial?: Expense
}): AddExpenseFormState {
  const { data: group }        = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const { data: profile }      = useCurrentProfile()
  const addExpense             = useAddExpense(groupId)
  const updateExpense          = useUpdateExpense(groupId)
  const pushToast              = useUIStore(s => s.pushToast)

  // Captured once — the form owns the values from here, and the seed is what
  // "dirty" is measured against. The sheet keys the form on the expense id,
  // so a different expense always mounts a fresh seed.
  const [seed] = useState(() => initial ? seedFromExpense(initial, isMobile) : null)
  const isEdit = !!seed

  const [amount,         setAmount]         = useState(seed?.amount ?? '')
  const [description,    setDescription]    = useState(seed?.description ?? '')
  const [note,           setNote]           = useState('')
  const [category,       setCategory]       = useState(seed?.category ?? '💸')
  // A saved category is a decision, not a guess to re-derive from the description.
  const [manualCategory, setManualCategory] = useState(isEdit)
  const [splitMode,      setSplitMode]      = useState<SplitMode>(seed?.splitMode ?? 'equal')
  const [paidById,       setPaidById]       = useState<string | null>(seed?.paidById ?? null)
  const [expenseDate,    setExpenseDate]    = useState(() => seed?.expenseDate ?? localISODate())
  const [included,       setIncluded]       = useState<Set<string>>(() => seed ? new Set(seed.included) : new Set())
  const [percents,       setPercents]       = useState<Record<string, string>>(seed?.percents ?? {})
  const [exactAmounts,   setExactAmounts]   = useState<Record<string, string>>(seed?.exactAmounts ?? {})
  const [focusId,        setFocusId]        = useState<string | null>(null)
  const [openPanel,      setOpenPanel]      = useState<OpenPanel>(null)

  // Once the user edits a field by hand we stop re-deriving even shares for
  // that mode — their numbers are intent, not a placeholder. Saved shares
  // count as touched from the start.
  const [percentTouched, setPercentTouched] = useState(isEdit)
  const [exactTouched,   setExactTouched]   = useState(isEdit)

  // Seats on the saved expense that the members query no longer returns —
  // people who have left the group. Leaving never deletes the seat, so their
  // split still points at it; without loading them here the stale-member
  // cleanup below would silently drop their share on save. Edit-only: a new
  // expense never offers a former member.
  const loadedIds = new Set((members as GroupMember[]).map(m => m.id))
  const formerIds = initial
    ? [...new Set([...(initial.splits ?? []).map(s => s.group_member_id), initial.paid_by])]
        .filter(id => !loadedIds.has(id))
    : []
  const { data: formerMembers = [] } = useQuery({
    queryKey: ['group_members', groupId, 'former', formerIds.join(',')],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('group_members')
        .select('*, profile:profiles!group_members_user_id_fkey(*)')
        .in('id', formerIds)
      if (error) throw error
      return (data ?? []) as GroupMember[]
    },
    // Wait for the members query, or every seat would look "former" on first render.
    enabled: formerIds.length > 0 && members.length > 0,
  })

  // Itemized receipt state — UI-only preview, nothing reaches handleSave yet
  const [items,    setItems]    = useState<LineItem[]>([])
  const [taxMode,  setTaxMode]  = useState<'percent' | 'flat'>('percent')
  const [taxVal,   setTaxVal]   = useState(0)
  const [tipMode,  setTipMode]  = useState<'percent' | 'flat'>('percent')
  const [tipVal,   setTipVal]   = useState(0)
  const nextItemId = useRef(0)

  const typedMembers = [...(members as GroupMember[]), ...formerMembers.filter(m => !loadedIds.has(m.id))]
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
      // A former member on the saved expense isn't stale — their seat may just
      // not have loaded yet.
      const stale = [...prev].filter(id => !memberById[id] && !seed?.included.has(id))
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

  /**
   * The escape hatch back to a balanced state after hand-editing: re-seed every
   * editable row with an even share. Marks the mode touched so the seeding
   * effect above treats these values as intent and stops re-deriving them.
   */
  function evenOut() {
    if (amountsIds.length === 0) return
    if (splitMode === 'exact') {
      const shares = evenShares(amt, amountsIds.length, 2)
      setExactTouched(true)
      setExactAmounts(prev => ({ ...prev, ...Object.fromEntries(amountsIds.map((id, i) => [id, shares[i]])) }))
    } else if (splitMode === 'percentage') {
      const shares = evenShares(100, amountsIds.length, 1)
      setPercentTouched(true)
      setPercents(prev => ({ ...prev, ...Object.fromEntries(amountsIds.map((id, i) => [id, shares[i]])) }))
    }
  }

  const subtotal  = items.reduce((s, it) => s + it.price, 0)
  const taxAmt    = taxMode === 'percent' ? round2(subtotal * taxVal / 100) : taxVal
  const tipAmt    = tipMode === 'percent' ? round2(subtotal * tipVal / 100) : tipVal
  const itemTotal = round2(subtotal + taxAmt + tipAmt)

  // Per CLAUDE.md's itemized formula: an item's price divides evenly among its
  // assignees, and tax + tip ride along in proportion to what each person
  // ordered. Rounded for display only — the exact-sum-to-total reconciliation
  // belongs in lib/splits.ts when there is a save path to reconcile for.
  const extras = taxAmt + tipAmt
  const itemShares: ItemShare[] = memberIds.map(memberId => {
    const share = items.reduce((a, it) => (
      it.assignedTo.includes(memberId) && it.assignedTo.length > 0
        ? a + it.price / it.assignedTo.length
        : a
    ), 0)
    const extra = subtotal > 0 ? extras * (share / subtotal) : 0
    return {
      memberId,
      subtotal: round2(share),
      extra:    round2(extra),
      total:    round2(share + extra),
    }
  })

  const baseValid = !!description.trim() && amt > 0 && !!paidById

  // Whether the split itself adds up, independent of whether the expense can be
  // saved. Itemized has nothing to balance yet, so the split sheet lets you
  // close it — saving is what stays blocked, on the next line.
  const splitValid =
    splitMode === 'equal'      ? included.size > 0 :
    splitMode === 'percentage' ? percentValid :
    splitMode === 'exact'      ? exactValid :
    true

  // Edit mode: has anything split-related moved off the saved expense? If not,
  // Save writes the saved split rows back untouched rather than re-deriving
  // them — percents are rounded on the way in, and re-deriving could shift a
  // cent between people on an edit that only fixed a typo.
  const sameIds = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(id => b.has(id))
  const splitDirty = !seed ||
    amount !== seed.amount ||
    splitMode !== seed.splitMode ||
    paidById !== seed.paidById ||
    !sameIds(included, seed.included) ||
    (splitMode === 'exact'      && [...included].some(id => (exactAmounts[id] ?? '') !== (seed.exactAmounts[id] ?? ''))) ||
    (splitMode === 'percentage' && [...included].some(id => (percents[id] ?? '')     !== (seed.percents[id] ?? '')))
  const isDirty = !seed || splitDirty ||
    description.trim() !== seed.description ||
    category !== seed.category ||
    expenseDate !== seed.expenseDate

  const isPending = addExpense.isPending || updateExpense.isPending
  const canSave = baseValid && isDirty && splitMode !== 'itemized' && (splitValid || !splitDirty)

  const idleLabel = isEdit ? 'Save changes' : 'Save expense'
  const saveLabel = isPending ? 'Saving…' :
    !baseValid                                                 ? idleLabel :
    !splitDirty                                                ? idleLabel :
    splitMode === 'percentage' && !percentValid                ? 'Balance to 100% first' :
    splitMode === 'exact'      && !exactValid                  ? "Doesn't add up yet" :
    splitMode === 'itemized'                                   ? 'Coming soon' :
    idleLabel

  // The rows Save would write, built once per render. The desktop ledger and
  // footer read the same object through `previewSplits`, so neither can show a
  // figure that differs from what gets saved — including where the leftover
  // cent of an uneven division ends up.
  function buildSplits(): {
    splitType: 'equal' | 'percentage' | 'exact'
    splits: { group_member_id: string; owed_amount: number }[]
  } | null {
    if (!paidById || amt <= 0 || splitMode === 'itemized' || !splitValid) return null
    const roundedAmt = round2(amt)
    const trim = (rows: { group_member_id: string; owed_amount: number }[]) =>
      rows.map(r => ({ group_member_id: r.group_member_id, owed_amount: r.owed_amount }))

    if (splitMode === 'equal') {
      return { splitType: 'equal', splits: trim(makeEqualSplits('', roundedAmt, [...included], paidById)) }
    }
    if (splitMode === 'percentage') {
      // Mobile: the payer takes whatever percentage the others left over.
      const percentInputs = [
        ...(isMobile ? [{
          group_member_id: paidById,
          percent: Math.max(0, round2(100 - percentSum)),
        }] : []),
        ...amountsIds.map(id => ({ group_member_id: id, percent: parseNum(percents[id]) })),
      ]
      return { splitType: 'percentage', splits: trim(makePercentSplits('', roundedAmt, percentInputs, paidById)) }
    }
    const exactInputs = [
      ...(isMobile ? [{
        group_member_id: paidById,
        owed_amount: Math.max(0, round2(roundedAmt - exactSum)),
      }] : []),
      ...amountsIds.map(id => ({ group_member_id: id, owed_amount: parseNum(exactAmounts[id]) })),
    ]
    return { splitType: 'exact', splits: trim(makeExactSplits('', exactInputs, roundedAmt, paidById)) }
  }

  const built = buildSplits()
  const previewSplits = built
    ? Object.fromEntries(built.splits.map(r => [r.group_member_id, r.owed_amount]))
    : null

  async function handleSave() {
    if (!canSave || isPending || !paidById) return

    if (initial && seed) {
      const splits = splitDirty ? built?.splits : (initial.splits ?? [])
      if (!splits) return
      try {
        await updateExpense.mutateAsync({
          expenseId: initial.id,
          description: description.trim(),
          amount: round2(amt),
          paid_by: paidById,
          split_type: splitDirty && built ? built.splitType : initial.split_type,
          splits,
          category,
          expense_date: expenseDate,
        })
      } catch {
        // The global MutationCache handler already toasts the error; the RPC
        // is one transaction, so nothing was written. Stay open to retry.
        return
      }
      onSuccess()
      return
    }

    if (!built) return

    const newExpense = await addExpense.mutateAsync({
      description: description.trim(),
      amount: round2(amt),
      paid_by: paidById,
      split_type: built.splitType,
      splits: built.splits,
      category,
      expense_date: expenseDate,
    })

    // Note is ephemeral form state, not a column on expenses — post it as the
    // expense's first comment via the existing comments feature. Best-effort:
    // the expense already saved, so a failure here only surfaces a toast and
    // never blocks navigation.
    const trimmedNote = note.trim()
    if (trimmedNote && youMemberId) {
      try {
        await insertExpenseComment(createClient(), {
          expenseId: newExpense.id, groupId, seatId: youMemberId, body: trimmedNote,
        })
      } catch {
        pushToast("Expense saved, but the note didn't post")
      }
    }

    onSuccess()
  }

  return {
    group,
    groupLabel: group ? `${group.emoji} ${group.name}` : '…',
    members: typedMembers, memberIds, memberById, slotById, youMemberId,

    amount, setAmount, amt,
    description, setDescription,
    note, setNote,
    category, selectCategory, manualCategory,
    expenseDate, setExpenseDate,
    splitMode, setSplitMode,
    paidById, setPaidById,

    included, toggleIncluded,
    percents, setPercent,
    exactAmounts, setExactAmount,

    amountsIds, percentValid, exactValid, percentRemaining, exactRemaining,
    splitValid, evenOut, previewSplits,

    focusId, setFocusId, openPanel, setOpenPanel,

    items,
    upsertItem: (id, item) => setItems(prev => (
      id === null
        ? [...prev, { ...item, id: ++nextItemId.current }]
        : prev.map(it => it.id === id ? { ...item, id } : it)
    )),
    removeItem: id => setItems(prev => prev.filter(it => it.id !== id)),
    clearItems: () => setItems([]),
    taxMode, setTaxMode, taxVal, setTaxVal,
    tipMode, setTipMode, tipVal, setTipVal,
    subtotal, taxAmt, tipAmt, itemTotal, itemShares,

    isEdit, isDirty,
    canSave, saveLabel, isPending, handleSave,
  }
}
