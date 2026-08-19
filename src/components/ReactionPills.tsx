'use client'

import { useRef, useState } from 'react'
import { T, F } from '@/design/tokens'
import { SectionLabel } from '@/components/SectionLabel'
import { EmojiPicker } from '@/components/EmojiPicker'
import { REACTION_EMOJI } from '@/lib/emoji'
import { hasReacted } from '@/lib/reactions'
import { useExpenseSocial, useToggleReaction } from '@/queries/useExpenseSocial'
import { useUIStore } from '@/store/ui'

interface Props {
  expenseId: string
  groupId: string
  /** The viewer's seat. Absent (or inactive) means read-only. */
  mySeatId?: string
  /** False for guests and left members, whose writes RLS would reject. */
  canPost: boolean
  /** `row` sits inside a feed card; `drawer` is the roomier detail-sheet size. */
  size?: 'row' | 'drawer'
  /** Renders a section heading above, and only when there is something to show. */
  label?: string
}

const SIZES = {
  row:    { pill: '4px 10px 4px 8px',  emoji: 13.5, count: 11.5, btn: 28, btnEmoji: 13 },
  drawer: { pill: '5px 12px 5px 10px', emoji: 15,   count: 12,   btn: 34, btnEmoji: 14 },
} as const

/**
 * The reaction row — count pills plus an add button — shared by the feed card
 * and the expense detail drawer at two sizes.
 *
 * It reads the cache itself rather than taking reactions as props: the feed and
 * the drawer mount the same `['expense-social', groupId]` key, so TanStack
 * dedupes to one fetch and one optimistic update keeps both in sync. Drilling
 * props from the page would mean keeping them aligned by hand.
 *
 * Counts and highlight both come from `memberIds` — who reacted is deliberately
 * not rendered, though the ids are in the cache if that ever changes.
 */
export function ReactionPills({ expenseId, groupId, mySeatId, canPost, size = 'row', label }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement | null>(null)
  const { data, isPending } = useExpenseSocial(groupId)
  const toggle = useToggleReaction(groupId)
  const pushToast = useUIStore(s => s.pushToast)

  const s = SIZES[size]
  const groups = data?.[expenseId] ?? []
  const canReact = canPost && !!mySeatId
  const mine = mySeatId ? groups.filter(g => g.memberIds.includes(mySeatId)).map(g => g.emoji) : []

  // Nothing to show and nothing to offer — take up no space at all.
  if (!groups.length && !canReact) return null

  function react(emoji: string) {
    if (!canReact || !mySeatId) return
    toggle.mutate(
      { expenseId, emoji, seatId: mySeatId, active: hasReacted(groups, emoji, mySeatId) },
      // Rollback is the hook's job; this is so a rejected write isn't silent.
      { onError: () => pushToast('Couldn’t save that reaction') }
    )
  }

  // `reaction-add` + `data-open` are the hooks for the desktop hover-reveal:
  // inside a feed card the button fades in only on row hover, so an un-reacted
  // expense carries no visible chrome. The CSS lands with the feed cards it
  // depends on — there is no row element to hover yet. Only the row size opts
  // in; the drawer has nothing to hover and shows the button outright.
  const addButton = (
    <button
      ref={addRef}
      className={size === 'row' ? 'reaction-add' : undefined}
      data-open={pickerOpen || undefined}
      onClick={e => { e.stopPropagation(); setPickerOpen(o => !o) }}
      disabled={isPending}
      aria-label="Add reaction"
      aria-haspopup="menu"
      aria-expanded={pickerOpen}
      style={{
        width: s.btn, height: s.btn, borderRadius: T.r.pill,
        border: `1px dashed ${T.lineStrong}`, background: 'transparent',
        cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.4 : 1,
        color: T.inkMuted, fontSize: s.btnEmoji, fontFamily: F,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      😊
    </button>
  )

  return (
    <div>
      {label && <SectionLabel size="sm" style={{ marginBottom: 10, padding: '0 2px' }}>{label}</SectionLabel>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {groups.map(g => {
          const on = mySeatId ? g.memberIds.includes(mySeatId) : false
          return (
            <button
              key={g.emoji}
              onClick={e => { e.stopPropagation(); react(g.emoji) }}
              disabled={!canReact}
              aria-pressed={on}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: s.pill, borderRadius: T.r.pill, border: 0,
                cursor: canReact ? 'pointer' : 'default',
                background: on ? T.sunSoft : T.surfaceAlt,
                boxShadow: on ? `inset 0 0 0 1.5px ${T.sun}` : `inset 0 0 0 1px ${T.line}`,
                fontSize: s.emoji, fontFamily: F, lineHeight: 1.2,
              }}
            >
              <span>{g.emoji}</span>
              <span style={{ fontSize: s.count, fontWeight: 700, color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
                {g.memberIds.length}
              </span>
            </button>
          )
        })}

        {canReact && addButton}
      </div>

      {/* Above the 301 that both the Vaul sheet and the desktop Modal occupy —
          this opens from inside the detail drawer as well as from the feed. */}
      <EmojiPicker
        open={pickerOpen}
        emojis={REACTION_EMOJI}
        selected={mine}
        title="Add a reaction"
        anchorRef={addRef}
        zIndex={400}
        onClose={() => setPickerOpen(false)}
        onPick={react}
      />
    </div>
  )
}
