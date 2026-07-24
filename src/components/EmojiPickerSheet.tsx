'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { T, F, FH } from '@/design/tokens'
import { useBodyScrollLock } from '@/components/modal/useBodyScrollLock'

const EMOJIS = ['💸', '🏖️', '🍕', '✈️', '🏠', '🎉', '🛒', '🚗', '🍽️', '💪', '🎮', '❤️', '🌲', '🏔️', '🎿', '🍻']

interface Props {
  open: boolean
  current: string
  onClose: () => void
  onPick: (emoji: string) => void
}

export function EmojiPickerSheet({ open, current, onClose, onPick }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
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
            Choose emoji
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => { onPick(e); onClose() }}
                style={{ width: 52, height: 52, borderRadius: T.r.card, cursor: 'pointer', fontSize: 24, border: e === current ? `2px solid ${T.sun}` : `1px solid ${T.line}`, background: e === current ? T.sunSoft : 'transparent', font: 'inherit', fontFamily: F }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
