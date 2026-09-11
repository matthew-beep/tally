'use client'

import type { ReactNode, Ref } from 'react'
import { T, FH, F, FMONO, well } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, round2 } from '@/lib/money'
import type { GroupMember } from '@/types'
import { splitSentence } from './types'
import { shortName } from './parts'
import type { AddExpenseFormState } from './useAddExpenseForm'

/**
 * One tappable word in the sentence. Raised at rest, recessed with a sun rim
 * while its sheet is open — the same two states the tabs and inputs already
 * use, so the token introduces no new material.
 */
function TkTok({ open, onClick, avatar, children }: {
  open: boolean; onClick: () => void; avatar?: ReactNode; children: ReactNode
}) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40,
        padding: avatar ? '8px 13px 8px 8px' : '9px 14px',
        borderRadius: T.r.md, cursor: 'pointer',
        fontFamily: FH, fontSize: 15.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink,
        // well() carries its own border/transition, so the raised branch states
        // the matching pair rather than the base declaring them twice.
        ...(open
          ? well(true)
          : { background: T.surface, boxShadow: T.shadowRaised, border: 0, transition: 'box-shadow .15s ease' }),
      }}
    >
      {avatar}{children}
    </button>
  )
}

/** "you" reads better mid-sentence than "You"; real names keep their capital. */
function payerWord(m: GroupMember | undefined, youMemberId?: string): string {
  const name = shortName(m, youMemberId)
  return name === 'You' ? 'you' : name
}

/**
 * The two decisions that used to be a pair of labelled rows — who paid, and how
 * it splits — said as one line with two tappable words. Each token opens the
 * sheet that owns exactly the thing it names.
 *
 * By default the tokens drive the mobile sheets through `s.openPanel`. The
 * desktop dialog passes its own open state and handlers instead, because there
 * the payer popover and the split ledger are independent and can both be open.
 * `payerRef` is the popover's anchor.
 */
export function TokenSentence({ s, align = 'center', payerOpen, splitOpen, onPayer, onSplit, payerRef }: {
  s: AddExpenseFormState
  align?: 'center' | 'start'
  payerOpen?: boolean
  splitOpen?: boolean
  onPayer?: () => void
  onSplit?: () => void
  payerRef?: Ref<HTMLSpanElement>
}) {
  const payer = s.paidById ? s.memberById[s.paidById] : undefined
  const word  = { fontSize: 14, fontWeight: 600, color: T.inkMuted, letterSpacing: -0.1 }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: align === 'center' ? 'center' : 'flex-start', gap: 8, rowGap: 8, fontFamily: F,
    }}>
      <span style={word}>Paid by</span>
      <span ref={payerRef} style={{ display: 'inline-flex' }}>
        <TkTok
          open={payerOpen ?? s.openPanel === 'payer'}
          onClick={onPayer ?? (() => s.setOpenPanel('payer'))}
          avatar={
            <Avatar
              profile={payer ? avatarProfile(payer) : undefined}
              slot={s.paidById ? (s.slotById[s.paidById] ?? 0) : 0}
              size={20} isYou={s.paidById === s.youMemberId}
            />
          }
        >{payerWord(payer, s.youMemberId)}</TkTok>
      </span>

      <span style={word}>and split</span>
      <TkTok
        open={splitOpen ?? s.openPanel === 'split'}
        onClick={onSplit ?? (() => s.setOpenPanel('split'))}
      >
        {splitSentence(s.splitMode)}
      </TkTok>
    </div>
  )
}

/** "Sam", "Sam and Jordan", "4 people" — never a list long enough to wrap badly. */
function whoLabel(ids: string[], s: AddExpenseFormState): string {
  const names = ids.map(id => shortName(s.memberById[id], s.youMemberId))
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.length} people`
}

/**
 * What the sentence above actually costs, in money. Deliberately only asserts a
 * per-head figure for an equal split — under exact/percentage/itemized the
 * per-person numbers live in the split sheet, and averaging them here would
 * state a number nobody actually owes.
 */
export function ShareLine({ s }: { s: AddExpenseFormState }) {
  const included = s.memberIds.filter(id => s.included.has(id))
  const others   = included.filter(id => id !== s.paidById)
  const youIn    = !!s.youMemberId && s.included.has(s.youMemberId)
  const each     = formatAmount(included.length > 0 ? round2(s.amt / included.length) : 0)
  const strong   = { color: T.ink, fontWeight: 800, fontFamily: FMONO }

  let body: ReactNode
  if (s.splitMode === 'itemized') {
    body = <>Split line by line · <span style={{ color: T.ink, fontWeight: 800 }}>tax and tip shared in proportion</span></>
  } else if (s.splitMode !== 'equal') {
    body = <>Split {splitSentence(s.splitMode)} across <span style={{ color: T.ink, fontWeight: 800 }}>{included.length} people</span></>
  } else if (s.paidById === s.youMemberId) {
    body = others.length === 0
      ? <>Only you in this split</>
      : <>{whoLabel(others, s)} owe{others.length === 1 ? 's' : ''} you <span style={strong}>{each}</span> each</>
  } else if (youIn) {
    body = <>You owe <span style={strong}>{each}</span> to {shortName(s.memberById[s.paidById ?? ''], s.youMemberId)}</>
  } else {
    // Someone else paid and you aren't in the split — no "you" claim to make.
    body = <><span style={strong}>{each}</span> each · {included.length} people</>
  }

  return (
    <div style={{ textAlign: 'center', fontFamily: F, fontSize: 12.8, fontWeight: 700, color: T.inkMuted }}>
      {body}
    </div>
  )
}
