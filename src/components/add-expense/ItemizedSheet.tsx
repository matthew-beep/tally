'use client'

import { useRef, useState } from 'react'
import { T, FH, F, FMONO, well } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { Btn } from '@/components/Btn'
import { Input } from '@/components/Input'
import { ModalHeader, ModalContent } from '@/components/modal'
import { avatarProfile } from '@/lib/memberDisplay'
import { formatAmount, parseNum } from '@/lib/money'
import { ItemComposer, BLANK_DRAFT, type ItemDraft } from './ItemComposer'
import { shortName } from './parts'
import type { LineItem } from './types'
import type { AddExpenseFormState } from './useAddExpenseForm'

/** Overlapping faces — who shared this line, at a glance and without names. */
function FaceStack({ ids, s }: { ids: string[]; s: AddExpenseFormState }) {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }}>
      {ids.slice(0, 4).map((id, i) => {
        const m = s.memberById[id]
        if (!m) return null
        return (
          <span key={id} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', display: 'inline-flex', boxShadow: `0 0 0 2px ${T.bg}` }}>
            <Avatar profile={avatarProfile(m)} slot={s.slotById[id] ?? 0} size={22} isYou={id === s.youMemberId} />
          </span>
        )
      })}
      {ids.length > 4 && (
        <span style={{
          marginLeft: -8, width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: T.surfaceAlt, boxShadow: `0 0 0 2px ${T.bg}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: F, fontSize: 9.5, fontWeight: 800, color: T.inkMuted,
        }}>+{ids.length - 4}</span>
      )}
    </span>
  )
}

/**
 * A line that's already on the bill. Read-only on purpose — the fields that
 * would edit it live in the composer below, and a row that both displays and
 * edits is the thing this redesign is getting rid of. Tapping loads it back
 * into the composer; the × removes it outright.
 */
function ItemRow({ item, s, editing, onEdit, onRemove }: {
  item: LineItem; s: AddExpenseFormState; editing: boolean
  onEdit: () => void; onRemove: () => void
}) {
  const each = item.assignedTo.length > 0 ? item.price / item.assignedTo.length : item.price

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '11px 14px', borderRadius: T.r.tab,
      // While its values are in the composer the row is a placeholder for
      // itself: pressed in, ringed, and faded, so there is never a moment where
      // the same line appears to exist twice as two live things.
      background: editing ? T.sink : 'transparent',
      boxShadow: editing
        ? `${T.shadowRecessed}, inset 0 0 0 1.5px ${T.sun}`
        : `inset 0 0 0 1.25px ${T.lineStrong}`,
      opacity: editing ? 0.55 : 1,
      transition: 'opacity .15s ease, box-shadow .15s ease',
    }}>
      <button
        type="button" onClick={onEdit}
        style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: F, color: T.ink }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: FH, fontSize: 16, fontWeight: 700, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </span>
          <span style={{ display: 'block', marginTop: 2, fontFamily: FMONO, fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>
            {formatAmount(each)} each
          </span>
        </span>
        <FaceStack ids={item.assignedTo} s={s} />
        <span style={{ flexShrink: 0, fontFamily: FH, fontSize: 16.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatAmount(item.price)}
        </span>
      </button>
      <button
        type="button" onClick={onRemove} aria-label={`Remove ${item.name || 'item'}`}
        style={{ width: 30, height: 30, flexShrink: 0, borderRadius: T.r.sm, border: 0, background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.inkMuted }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}

/**
 * Tax or tip. The design specifies a flat dollar field; the percent/flat toggle
 * is kept from the previous builder because tax is a rate you know ("8.5%") far
 * more often than a figure you'd rather retype, and both resolve to the same
 * dollar amount downstream. "Shared in proportion" states the rule once, here,
 * rather than leaving people to infer it from the per-person rows above.
 */
function ExtraRow({ label, mode, setMode, val, setVal, amt }: {
  label: string
  mode: 'percent' | 'flat'; setMode: (m: 'percent' | 'flat') => void
  val: number; setVal: (v: number) => void; amt: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0' }}>
      <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: T.inkMuted }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 11.5, fontWeight: 700, color: T.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        shared in proportion
      </span>
      <div style={{ display: 'flex', flexShrink: 0, borderRadius: T.r.pill, padding: 2, gap: 1, ...well() }}>
        {(['percent', 'flat'] as const).map(opt => {
          const on = mode === opt
          return (
            <button
              key={opt} type="button" onClick={() => setMode(opt)}
              style={{
                padding: '3px 9px', borderRadius: T.r.pill, border: 0, cursor: 'pointer', fontFamily: F,
                fontSize: 11, fontWeight: on ? 700 : 500, color: on ? T.ink : T.inkMuted,
                background: on ? T.surface : 'transparent', boxShadow: on ? T.shadowRaised : T.shadowNone,
              }}
            >{opt === 'percent' ? '%' : '$'}</button>
          )
        })}
      </div>
      <Input
        size="cell" alignRight fieldWidth={36}
        prefix={mode === 'flat' ? '$' : undefined}
        suffix={mode === 'percent' ? '%' : undefined}
        type="number" inputMode="decimal" min={0} value={val || ''}
        onChange={e => setVal(Math.max(0, parseFloat(e.target.value) || 0))}
        aria-label={label}
      />
      <span style={{ flexShrink: 0, minWidth: 48, textAlign: 'right', fontFamily: FMONO, fontSize: 12, fontWeight: 600, color: T.inkMuted }}>
        {formatAmount(amt)}
      </span>
    </div>
  )
}

/**
 * The itemize sheet: what's on the bill, one composer, and a pull-open summary.
 *
 * Three zones, and only the middle one is editable. Above the composer are
 * settled lines. Below it, outside the scroller, is a strip that states the
 * bill in one line and opens to show what each person actually owes — the
 * figure the whole exercise exists to produce, which the previous builder
 * never showed at all. The commit button is the only thing that writes back to
 * the expense: until it's pressed, filling in a receipt has changed nothing
 * about the split.
 *
 * Renders header/content/footer as siblings so the footer sits outside the
 * scroller — the caller supplies the ModalOrSheet around it.
 */
export function ItemizedSheet({ s, onClose, onUse }: {
  s: AddExpenseFormState
  onClose: () => void
  onUse: () => void
}) {
  const [draft, setDraft]         = useState<ItemDraft>(BLANK_DRAFT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [totalsOpen, setTotalsOpen] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const { items, subtotal, taxAmt, tipAmt, itemTotal, itemShares } = s
  const extras = taxAmt + tipAmt

  function commit() {
    s.upsertItem(editingId, {
      name: draft.name.trim(),
      price: parseNum(draft.price),
      assignedTo: draft.assignedTo,
    })
    setDraft(BLANK_DRAFT)
    setEditingId(null)
    // Keep the caret where the next item goes — entering a bill is a rhythm,
    // and losing focus after every line breaks it.
    nameRef.current?.focus()
  }

  function edit(item: LineItem) {
    setDraft({ name: item.name, price: item.price.toFixed(2), assignedTo: [...item.assignedTo] })
    setEditingId(item.id)
    setTotalsOpen(false)
  }

  function cancelEdit() {
    setDraft(BLANK_DRAFT)
    setEditingId(null)
  }

  function remove(id: number) {
    s.removeItem(id)
    if (editingId === id) cancelEdit()
  }

  const summary = items.length === 0
    ? 'No items yet'
    : `${items.length} item${items.length === 1 ? '' : 's'} · ${formatAmount(subtotal)}${extras > 0 ? ` + ${formatAmount(extras)} tax & tip` : ''}`

  return (
    <>
      <ModalHeader
        title="Itemize"
        onClose={onClose}
        right={items.length > 0 ? (
          // Phase 3 pre-fills the lines below from OCR. Present but inert, so
          // the layout it will land in is the one being designed against.
          <Btn variant="outline" size="sm" disabled title="Coming soon">Scan receipt</Btn>
        ) : undefined}
      />

      <ModalContent style={{ padding: '16px 20px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <ItemRow
              key={item.id} item={item} s={s}
              editing={editingId === item.id}
              onEdit={() => edit(item)}
              onRemove={() => remove(item.id)}
            />
          ))}

          <ItemComposer
            draft={draft} onChange={setDraft} onCommit={commit} onCancel={cancelEdit}
            editing={editingId !== null}
            memberIds={s.memberIds} memberById={s.memberById} slotById={s.slotById}
            youMemberId={s.youMemberId}
            autoFocus={items.length === 0}
            inputRef={nameRef}
          />

          {items.length === 0 && !draft.name.trim() && (
            <p style={{ margin: '2px 4px 0', fontFamily: F, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: T.inkFaint }}>
              Add each line from the bill and tap the people who shared it. Tax and tip go in once at
              the bottom — they&rsquo;re split in proportion to what everyone ordered.
            </p>
          )}
        </div>
      </ModalContent>

      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
        borderTop: `0.5px solid ${T.line}`, background: T.bg,
        padding: '10px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
      }}>
        {/* A summary you pull open, not a tab you switch to — the bill and the
            per-person outcome are the same screen, one folded under the other. */}
        <button
          type="button" onClick={() => setTotalsOpen(v => !v)} disabled={items.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '4px 2px', border: 0, background: 'transparent', cursor: items.length ? 'pointer' : 'default', fontFamily: F, color: T.ink }}
        >
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 13, fontWeight: 700, color: T.inkMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary}
          </span>
          <span style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatAmount(itemTotal)}
          </span>
          <svg
            width="11" height="7" viewBox="0 0 11 7" fill="none"
            style={{ flexShrink: 0, transform: totalsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}
          >
            <path d="M1 1l4.5 4.5L10 1" stroke={T.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {totalsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '38dvh', overflowY: 'auto' }}>
            {itemShares.map(p => {
              const m = s.memberById[p.memberId]
              return (
                <div key={p.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px' }}>
                  <span style={{ display: 'inline-flex', flexShrink: 0, opacity: p.total > 0 ? 1 : 0.4 }}>
                    <Avatar profile={m ? avatarProfile(m) : undefined} slot={s.slotById[p.memberId] ?? 0} size={26} isYou={p.memberId === s.youMemberId} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: F, fontSize: 13.5, fontWeight: 700, color: p.total > 0 ? T.ink : T.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shortName(m, s.youMemberId)}
                  </span>
                  {p.extra > 0 && (
                    <span style={{ flexShrink: 0, fontFamily: FMONO, fontSize: 11.5, fontWeight: 600, color: T.inkFaint }}>
                      +{formatAmount(p.extra)} tax &amp; tip
                    </span>
                  )}
                  <span style={{ flexShrink: 0, minWidth: 62, textAlign: 'right', fontFamily: FH, fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.total > 0 ? T.ink : T.inkFaint }}>
                    {p.total > 0 ? formatAmount(p.total) : '—'}
                  </span>
                </div>
              )
            })}
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: `0.5px solid ${T.line}` }}>
              <ExtraRow label="Tax" mode={s.taxMode} setMode={s.setTaxMode} val={s.taxVal} setVal={s.setTaxVal} amt={taxAmt} />
              <ExtraRow label="Tip" mode={s.tipMode} setMode={s.setTipMode} val={s.tipVal} setVal={s.setTipVal} amt={tipAmt} />
            </div>
          </div>
        )}

        <Btn
          onClick={onUse} disabled={items.length === 0} variant="primary" size="lg" fullWidth
          style={{ borderRadius: 15, padding: '16px', fontFamily: FH, fontSize: 16.5 }}
        >
          {items.length === 0 ? 'Add the first item' : `Use this split · ${formatAmount(itemTotal)}`}
        </Btn>
      </div>
    </>
  )
}
