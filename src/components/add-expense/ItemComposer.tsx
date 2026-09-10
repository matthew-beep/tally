'use client'

import type { RefObject } from 'react'
import { T, FH, F, FMONO } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, sanitizeAmount, parseNum } from '@/lib/money'
import { shortName } from './parts'
import type { GroupMember } from '@/types'

/**
 * One line of the bill, mid-edit. `price` is a string rather than a number
 * because this is a typing buffer — "18." and "" are states you pass through on
 * the way to a value, and coercing on every keystroke eats the decimal point.
 * It settles into `LineItem.price` when the draft is committed.
 */
export interface ItemDraft {
  name: string
  price: string
  assignedTo: string[]
}

export const BLANK_DRAFT: ItemDraft = { name: '', price: '', assignedTo: [] }

/**
 * One person, as a toggle. Selected reads as a recessed trough with a sun rim —
 * pressed in, the same way every other "this one is chosen" surface in the app
 * reads — and unselected is a flat hairline outline rather than a second fill,
 * so a row of four doesn't turn into a row of four competing objects.
 */
function FaceToggle({ member, slot, youMemberId, on, onClick }: {
  member: GroupMember; slot: 0 | 1 | 2 | 3; youMemberId?: string; on: boolean; onClick: () => void
}) {
  const isYou = member.id === youMemberId
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
        minHeight: 44, padding: '5px 14px 5px 5px', borderRadius: T.r.pill,
        border: 0, cursor: 'pointer', fontFamily: F, fontSize: 13.5, fontWeight: 700,
        color: on ? T.ink : T.inkFaint,
        background: on ? T.sink : 'transparent',
        boxShadow: on ? `${T.shadowRecessed}, inset 0 0 0 1.5px ${T.sun}` : T.shadowHair,
        transition: 'box-shadow .15s ease, color .15s ease',
      }}
    >
      <span style={{ display: 'inline-flex', opacity: on ? 1 : 0.4, transition: 'opacity .15s ease' }}>
        <Avatar profile={avatarProfile(member)} slot={slot} size={30} isYou={isYou} />
      </span>
      {shortName(member, youMemberId)}
    </button>
  )
}

/**
 * The composer — the only editable thing in the itemize sheet, and the only way
 * a line gets added.
 *
 * The rows above it are settled facts: read-only, tapped to load back in here.
 * That is the whole trade. `ItemizedBuilder` made every field on every row live
 * at once, which meant a receipt with eight lines put twenty-four inputs and
 * thirty-two avatar toggles on screen simultaneously, and nothing said which
 * one you were meant to be filling in. Here there is exactly one, always in the
 * same place, and it asks for the item in the order a person reads a receipt:
 * what it was, what it cost, who had it.
 *
 * Price and faces stay dimmed until the item is named — the sequence is visible
 * without disabling anything, so a user who wants to fill it out of order still
 * can. The commit button carries the next instruction instead of a static
 * label, which means the card never needs a separate line of validation text.
 */
export function ItemComposer({
  draft, onChange, onCommit, onCancel, editing,
  memberIds, memberById, slotById, youMemberId, autoFocus = true, inputRef,
}: {
  draft: ItemDraft
  onChange: (next: ItemDraft) => void
  onCommit: () => void
  onCancel: () => void
  /** True when the draft came from an existing line — swaps Add for Save, reveals Cancel. */
  editing: boolean
  memberIds: string[]
  memberById: Record<string, GroupMember>
  slotById: Record<string, 0 | 1 | 2 | 3>
  youMemberId?: string
  autoFocus?: boolean
  /** Lets the sheet put the caret back after a commit, so entry keeps its rhythm. */
  inputRef?: RefObject<HTMLInputElement>
}) {
  const named  = draft.name.trim().length > 0
  const price  = parseNum(draft.price)
  const priced = price > 0
  const ready  = named && priced && draft.assignedTo.length > 0
  const each   = draft.assignedTo.length > 0 ? price / draft.assignedTo.length : 0
  const all    = draft.assignedTo.length === memberIds.length

  const toggle = (id: string) => onChange({
    ...draft,
    assignedTo: draft.assignedTo.includes(id)
      ? draft.assignedTo.filter(x => x !== id)
      : [...draft.assignedTo, id],
  })

  const label =
    editing ? 'Save item'          :
    !named  ? 'Name the item'      :
    !priced ? 'Add a price'        :
    draft.assignedTo.length === 0
            ? 'Pick who shared it' :
              'Add item'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: '14px 15px 15px', borderRadius: T.r.panel,
      background: T.surface,
      // Outset rim, not the inset one `well()` uses: this is a raised card that
      // has become complete, not a trough that has taken focus.
      boxShadow: `${T.shadowRaised}, 0 0 0 1.5px ${ready ? T.sun : 'transparent'}`,
      transition: 'box-shadow .18s ease',
    }}>
      {/* 1 · what it is, and what it cost */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
          placeholder="Item name"
          style={{
            flex: 1, minWidth: 0, height: 46, border: 0, outline: 'none',
            background: 'transparent', padding: 0, color: T.ink,
            fontFamily: FH, fontSize: 19, fontWeight: 700, letterSpacing: -0.3,
          }}
        />
        <span style={{ flexShrink: 0, opacity: named ? 1 : 0.45, transition: 'opacity .18s ease' }}>
          <Input
            size="cell" prefix="$" alignRight fieldWidth={58}
            inputMode="decimal" placeholder="0.00"
            value={draft.price}
            onChange={e => onChange({ ...draft, price: sanitizeAmount(e.target.value) })}
            aria-label="Item price"
          />
        </span>
      </div>

      {/* 2 · who shared it */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, opacity: named ? 1 : 0.45, transition: 'opacity .18s ease' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: T.inkFaint }}>
            Who shared it
          </span>
          {priced && draft.assignedTo.length > 0 && (
            <span style={{ fontFamily: FMONO, fontSize: 12, fontWeight: 700, color: T.inkMuted }}>
              {formatAmount(each)} each
            </span>
          )}
          <Btn
            onClick={() => onChange({ ...draft, assignedTo: all ? [] : [...memberIds] })}
            variant="outline" size="sm"
            style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11.5 }}
          >{all ? 'None' : 'Everyone'}</Btn>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {memberIds.map(id => {
            const m = memberById[id]
            if (!m) return null
            return (
              <FaceToggle
                key={id} member={m} slot={slotById[id] ?? 0} youMemberId={youMemberId}
                on={draft.assignedTo.includes(id)} onClick={() => toggle(id)}
              />
            )
          })}
        </div>
      </div>

      {/* 3 · commit the line */}
      <div style={{ display: 'flex', gap: 8 }}>
        {editing && (
          <Btn onClick={onCancel} variant="outline" size="lg" style={{ flexShrink: 0, padding: '13px 18px', borderRadius: 14 }}>
            Cancel
          </Btn>
        )}
        <Btn
          onClick={onCommit} disabled={!ready} variant="primary" size="lg"
          style={{ flex: 1, minWidth: 0, borderRadius: 14, fontFamily: FH, fontSize: 15.5 }}
        >{label}</Btn>
      </div>
    </div>
  )
}
