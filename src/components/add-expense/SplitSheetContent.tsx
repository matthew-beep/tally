'use client'

import type { ReactNode } from 'react'
import { T, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { Segmented } from '@/components/Segmented'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, round2, stripNegative, parseNum } from '@/lib/money'
import type { GroupMember } from '@/types'
import { SPLIT_MODES } from './types'
import { RemainderInline, Checkbox, shortName, fmtPct } from './parts'
import { ItemizedBuilder } from './ItemizedBuilder'
import type { AddExpenseFormState } from './useAddExpenseForm'

// Avatar + name for one member row. Payer rows are non-interactive.
function PersonLabel({ m, id, slotById, isPayer, youMemberId, onClick }: {
  m: GroupMember | undefined; id: string; slotById: Record<string, 0|1|2|3>
  isPayer: boolean; youMemberId?: string; onClick: () => void
}) {
  return (
    <div
      onClick={() => { if (!isPayer) onClick() }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: isPayer ? 'default' : 'pointer', minWidth: 0 }}
    >
      <Avatar profile={m ? avatarProfile(m) : undefined} slot={slotById[id] ?? 0} size={30} isYou={id === youMemberId} />
      <span style={{ fontSize: 15, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {shortName(m, youMemberId)}
      </span>
    </div>
  )
}

// What the current mode adds up to, plus the way back to an even split. Sits
// directly under the tabs so the consequence of switching mode is visible
// before you scroll the member list.
function StatusRow({ s }: { s: AddExpenseFormState }) {
  const {
    splitMode, amt, memberIds, included, evenOut,
    percentValid, exactValid, percentRemaining, exactRemaining,
  } = s

  const activeCount = memberIds.filter(id => included.has(id)).length

  let status: ReactNode
  if (splitMode === 'exact') {
    status = (
      <RemainderInline
        valid={exactValid}
        label={exactValid ? 'Balanced' : exactRemaining > 0 ? 'Left to assign' : 'Over by'}
        value={exactValid ? '$0.00' : formatAmount(Math.abs(exactRemaining))}
      />
    )
  } else if (splitMode === 'percentage') {
    status = (
      <RemainderInline
        valid={percentValid}
        label={percentValid ? 'Adds up to 100%' : percentRemaining > 0 ? 'Left to assign' : 'Over by'}
        value={`${fmtPct(Math.abs(percentRemaining))}%`}
      />
    )
  } else if (splitMode === 'equal') {
    status = (
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted }}>
        <span style={{ fontFamily: FMONO }}>{formatAmount(activeCount > 0 ? round2(amt / activeCount) : 0)}</span>
        {' each · '}{activeCount} of {memberIds.length} people
      </span>
    )
  } else {
    status = (
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted }}>
        Tax and tip are shared in proportion
      </span>
    )
  }

  const canEvenOut = splitMode === 'exact' || splitMode === 'percentage'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 2px 9px', minHeight: 34 }}>
      <span style={{ flex: 1, minWidth: 0 }}>{status}</span>
      {canEvenOut && (
        <Btn onClick={evenOut} variant="soft" size="sm" style={{ flexShrink: 0 }}>Even it out</Btn>
      )}
    </div>
  )
}

// The member list for equal/exact/percentage.
// Balance semantics are unchanged from the inline version this replaced: equal
// divides the total across everyone included; exact/% only require the OTHER
// members to balance — the payer's share is whatever is left over, computed in
// handleSave. Rows read straight off the hook's shared validity state, so this
// can never disagree with the Save button.
function MemberSplitList({ s, payerId }: { s: AddExpenseFormState; payerId: string }) {
  const {
    splitMode, memberIds, memberById, slotById, amt: total, included, toggleIncluded,
    youMemberId, exactAmounts, setExactAmount, percents, setPercent,
  } = s

  const activeCount = memberIds.filter(id => included.has(id)).length
  const per = activeCount > 0 ? round2(total / activeCount) : 0

  return (
    <>
      {memberIds.map((id, idx) => {
        const m = memberById[id]
        const isPayer = id === payerId
        const on = included.has(id)
        const isLast = idx === memberIds.length - 1
        const pct = parseNum(percents[id])
        const rowAmt = on ? (isPayer ? total : per) : 0

        return (
          <div key={id} style={{
            display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0',
            borderBottom: isLast ? 'none' : `0.5px solid ${T.line}`,
            opacity: on ? 1 : 0.35, transition: 'opacity 0.15s',
          }}>
            {isPayer
              ? <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.bg }} />
                </div>
              : <Checkbox on={on} onClick={() => toggleIncluded(id)} />
            }
            <PersonLabel m={m} id={id} slotById={slotById} isPayer={isPayer} youMemberId={youMemberId} onClick={() => toggleIncluded(id)} />

            {splitMode === 'equal' ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: on ? T.ink : T.inkFaint }}>{formatAmount(rowAmt)}</div>
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>{isPayer ? 'paid' : on ? 'owes' : '—'}</div>
              </div>
            ) : isPayer ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 700, color: T.ink }}>{formatAmount(total)}</div>
                <div style={{ fontSize: 10, color: T.inkFaint, marginTop: 1 }}>paid</div>
              </div>
            ) : splitMode === 'exact' ? (
              <Input
                size="cell" prefix="$" alignRight fieldWidth={52} disabled={!on}
                type="number" inputMode="decimal" min={0}
                value={on ? (exactAmounts[id] ?? '') : ''}
                onChange={e => setExactAmount(id, stripNegative(e.target.value))}
                placeholder="0.00"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <Input
                  size="cell" suffix="%" alignRight fieldWidth={34} disabled={!on}
                  type="number" inputMode="decimal" min={0}
                  value={on ? (percents[id] ?? '') : ''}
                  onChange={e => setPercent(id, stripNegative(e.target.value))}
                  placeholder="0"
                />
                <span style={{ fontFamily: FMONO, fontSize: 10, color: T.inkFaint }}>{formatAmount(on ? total * pct / 100 : 0)}</span>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * The whole split decision in one place: which method, who is in, and how much
 * each owes. Previously the method lived in this sheet as a radio list while
 * the member list sat inline on the add-expense screen — one decision split
 * across two surfaces, and the reason the mobile screen was too tall to fit
 * without scrolling.
 *
 * Deliberately layout-agnostic — no fixed widths, no sheet chrome, and `onDone`
 * comes from the caller — so the desktop panel can drop it into its right-hand
 * column later without changes.
 */
export function SplitSheetContent({ s, onDone }: { s: AddExpenseFormState; onDone: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Segmented options={SPLIT_MODES} value={s.splitMode} onChange={s.setSplitMode} fullWidth />

      <StatusRow s={s} />

      {s.splitMode === 'itemized'
        ? <ItemizedBuilder s={s} />
        : s.paidById && <MemberSplitList s={s} payerId={s.paidById} />}

      <Btn
        onClick={onDone} disabled={!s.splitValid} variant="primary" size="lg" fullWidth
        style={{ marginTop: 18, borderRadius: 14 }}
      >
        {s.splitValid ? 'Done' : 'Amounts must add up'}
      </Btn>
    </div>
  )
}
