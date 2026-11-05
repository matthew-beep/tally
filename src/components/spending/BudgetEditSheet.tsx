'use client'

import { useEffect, useMemo, useState } from 'react'
import { T, F, FH } from '@/design/tokens'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { ModalHeader, SidePanelOrSheet } from '@/components/modal'
import { averageFinishedMonth, budgetForMonth, parseBudgetAmount, suggestedCap, type BudgetVersion } from '@/lib/budget'
import { CATEGORIES } from '@/lib/categories'
import { formatWholeDollars } from '@/lib/money'
import { calcMonthly, currentMonth, monthName, monthShort, shiftMonth } from '@/lib/spending'
import { localISODate } from '@/lib/time'
import { useSaveGroupBudget } from '@/queries/useGroupBudget'
import { useUIStore } from '@/store/ui'
import type { Expense } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
  groupName: string
  solo: boolean
  expenses: Expense[]
  versions: BudgetVersion[]
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    // The padding gives the 40×24 track a 44px tap target.
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      style={{ flexShrink: 0, padding: '10px 2px', border: 0, background: 'transparent', cursor: 'pointer' }}
    >
      <span style={{ display: 'block', position: 'relative', width: 40, height: 24, borderRadius: 12, background: on ? T.sun : T.surfaceAlt, boxShadow: T.shadowHair, transition: 'background .15s' }}>
        <i style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: T.surface, boxShadow: T.shadowSm, transform: on ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
      </span>
    </button>
  )
}

function AmountField({ label, value, on, onChange }: { label: string; value: string; on: boolean; onChange: (v: string) => void }) {
  return (
    <Input
      size="cell"
      prefix="$"
      alignRight
      fieldWidth={64}
      inputMode="decimal"
      aria-label={label}
      value={on ? value : ''}
      placeholder="—"
      disabled={!on}
      aria-invalid={on && parseBudgetAmount(value) == null}
      onChange={e => onChange(e.target.value)}
    />
  )
}

/**
 * Changes apply from the current month, so earlier months keep the budget they
 * were measured against. Removal is a save with nothing in it, for the same reason.
 */
export function BudgetEditSheet({ open, onClose, groupId, groupName, solo, expenses, versions }: Props) {
  const today = localISODate()
  const month = currentMonth(today)
  const previous = shiftMonth(month, -1)
  const existing = budgetForMonth(versions, month)
  const save = useSaveGroupBudget(groupId)
  const pushToast = useUIStore(s => s.pushToast)

  const [capOn, setCapOn] = useState(true)
  const [capText, setCapText] = useState('')
  /** Category emoji → typed amount. A key being present means its limit is on. */
  const [limitText, setLimitText] = useState<Record<string, string>>({})
  const [confirmRemove, setConfirmRemove] = useState(false)

  const lastMonth = useMemo(() => calcMonthly(expenses, [previous])[0], [expenses, previous])
  const average = useMemo(() => averageFinishedMonth(expenses, today), [expenses, today])

  // Start from what's saved each time it opens, discarding anything abandoned.
  useEffect(() => {
    if (!open) return
    const suggestion = suggestedCap(expenses, today)
    setCapOn(existing ? existing.cap != null : true)
    setCapText(existing?.cap != null ? String(existing.cap) : suggestion ? String(suggestion) : '')
    setLimitText(Object.fromEntries(Object.entries(existing?.limits ?? {}).map(([k, v]) => [k, String(v)])))
    setConfirmRemove(false)
    // Only on opening: a background refetch shouldn't overwrite what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const cap = capOn ? parseBudgetAmount(capText) : null
  const limits = Object.entries(limitText).map(([emoji, text]) => [emoji, parseBudgetAmount(text)] as const)
  const limitsValid = limits.every(([, amount]) => amount != null)
  const limitsTotal = limits.reduce((s, [, amount]) => s + (amount ?? 0), 0)
  const canSave = (!capOn || cap != null) && limitsValid && (capOn || limits.length > 0) && !save.isPending

  function toggleLimit(emoji: string) {
    setLimitText(current => {
      if (emoji in current) {
        const { [emoji]: _removed, ...rest } = current
        return rest
      }
      const last = lastMonth.byCategory[emoji]?.total ?? 0
      return { ...current, [emoji]: String(last > 0 ? Math.ceil(last / 50) * 50 : 100) }
    })
  }

  function submit(next: { cap: number | null; limits: Record<string, number> }) {
    save.mutate({ month, ...next }, {
      onSuccess: onClose,
      onError: () => pushToast('Could not save the budget. Try again.'),
    })
  }

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return }
    submit({ cap: null, limits: {} })
  }

  const free = cap != null ? cap - limitsTotal : null
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '7px 12px', borderRadius: T.r.card, boxShadow: T.shadowHair } as const

  return (
    <SidePanelOrSheet open={open} onClose={onClose} title={`${monthName(month)} budget`} width={480}>
      <ModalHeader title={`${monthName(month)} budget`} onClose={onClose} style={{ padding: '16px 16px 14px 24px', alignItems: 'center' }} />

      <div className="spending-breakdown" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 22px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridAutoRows: 'max-content', gap: 8, fontFamily: F, color: T.ink }}>
        <p style={{ margin: '0 2px 8px', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: T.inkMuted }}>
          Applies from {monthName(month)}. Past months keep the budget they had.
        </p>

        <div style={{ ...rowStyle, minHeight: 70 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: FH, fontSize: 16, fontWeight: 700 }}>Monthly total</span>
            <span style={{ display: 'block', marginTop: 1, fontSize: 12, fontWeight: 600, color: T.inkFaint }}>
              {average ? `About ${formatWholeDollars(average)} a month so far` : 'Everything the group spends'}
            </span>
          </span>
          <Switch on={capOn} label="Monthly total" onChange={() => setCapOn(on => !on)} />
          <AmountField label="Monthly total amount" value={capText} on={capOn} onChange={setCapText} />
        </div>

        {cap != null && free != null && (
          <div style={{ padding: '13px 14px', borderRadius: T.r.card, boxShadow: T.shadowHair }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
              {free >= 0
                ? `${formatWholeDollars(limitsTotal)} in limits · ${formatWholeDollars(free)} for everything else`
                : `Limits add up to ${formatWholeDollars(-free)} more than the total`}
            </div>
            {free < 0 && (
              <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: T.inkFaint }}>
                That&rsquo;s allowed, but something will have to come in under its limit.
              </div>
            )}
            <div style={{ height: 8, marginTop: 10, borderRadius: 5, background: T.surfaceAlt, overflow: 'hidden' }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min((limitsTotal / cap) * 100, 100)}%`, borderRadius: 5, background: free < 0 ? T.coral : T.sun }} />
            </div>
          </div>
        )}

        <div style={{ margin: '12px 2px 2px', fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: T.inkFaint }}>Category limits</div>

        {CATEGORIES.map(c => {
          const on = c.emoji in limitText
          return (
            <div key={c.emoji} style={rowStyle}>
              <span aria-hidden style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, background: T.surfaceAlt }}>{c.emoji}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>
                {c.label}
                <span style={{ display: 'block', marginTop: 1, fontSize: 12, fontWeight: 600, color: T.inkFaint }}>
                  {formatWholeDollars(lastMonth.byCategory[c.emoji]?.total ?? 0)} in {monthShort(previous)}
                </span>
              </span>
              <Switch on={on} label={`Limit for ${c.label}`} onChange={() => toggleLimit(c.emoji)} />
              <AmountField
                label={`${c.label} limit amount`}
                value={limitText[c.emoji] ?? ''}
                on={on}
                onChange={v => setLimitText(current => ({ ...current, [c.emoji]: v }))}
              />
            </div>
          )
        })}
      </div>

      <div style={{ flexShrink: 0, padding: '12px 24px 14px', borderTop: `1px solid ${T.line}`, fontFamily: F }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, color: T.inkFaint }}>
          {solo ? 'Only you can see this budget.' : `Everyone in ${groupName} can see and change this budget.`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
          {existing ? (
            <Btn variant="dangerOutline" size="sm" onClick={handleRemove} disabled={save.isPending}>
              {confirmRemove ? 'Tap again to remove' : 'Remove budget'}
            </Btn>
          ) : <span />}
          <Btn
            variant="primary"
            size="md"
            disabled={!canSave}
            onClick={() => submit({ cap, limits: Object.fromEntries(limits as [string, number][]) })}
            style={{ padding: '10px 18px' }}
          >
            {save.isPending ? 'Saving…' : 'Save budget'}
          </Btn>
        </div>
      </div>
    </SidePanelOrSheet>
  )
}
