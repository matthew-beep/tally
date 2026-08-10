'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F, FH } from '@/design/tokens'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'

interface Props {
  open: boolean
  /** The vocabulary to offer — see src/lib/emoji.ts. */
  emojis: readonly string[]
  /**
   * Currently-held emoji, rendered highlighted. Single-select callers pass a
   * one-element array; reactions pass every emoji the viewer holds.
   */
  selected?: readonly string[]
  title?: string
  /**
   * Stacking order. The default clears the page, but both the Vaul sheet and
   * the desktop Modal sit at 301 — callers opening this from inside one must
   * pass something higher or it renders behind them.
   */
  zIndex?: number
  onClose: () => void
  /** Called with the tapped emoji. Whether that sets or toggles is the caller's business. */
  onPick: (emoji: string) => void
}

/**
 * The one emoji picker. Group identity, expense reactions, and anything later
 * all use it — only `emojis` differs, so choosing an emoji feels the same
 * everywhere in the app.
 */
export function EmojiPickerSheet({
  open, emojis, selected = [], title = 'Choose emoji', zIndex = 300, onClose, onPick,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Capture phase + stopPropagation: when this is open inside a Modal or
      // sheet, that parent also has an Escape listener on window. Without this
      // one Escape would dismiss both, closing the expense drawer behind the
      // picker the user was only trying to back out of.
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    // Portal events propagate up the React tree, not the DOM tree, so a tap in
    // here would otherwise reach whatever rendered this sheet — in the feed,
    // the expense card's onClick.
    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'tally-fade 0.18s ease' }}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: `${T.r.sheet}px ${T.r.sheet}px 0 0`, background: T.bg, boxShadow: T.shadowModal, animation: 'tally-slideup 0.26s cubic-bezier(.34,1.0,.5,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 38, height: 5, borderRadius: 3, background: T.lineStrong }} />
        </div>
        <div style={{ padding: '18px 22px 40px' }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 700, color: T.inkMuted, textAlign: 'center', marginBottom: 16 }}>
            {title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {emojis.map(e => {
              const on = selected.includes(e)
              return (
                <button
                  key={e}
                  onClick={() => { onPick(e); onClose() }}
                  aria-pressed={on}
                  style={{ width: 52, height: 52, borderRadius: T.r.card, cursor: 'pointer', fontSize: 24, border: on ? `2px solid ${T.sun}` : `1px solid ${T.line}`, background: on ? T.sunSoft : 'transparent', font: 'inherit', fontFamily: F }}
                >
                  {e}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
