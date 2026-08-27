'use client'

import { T, F } from '@/design/tokens'
import { EmojiTile } from '@/components/EmojiTile'
import { CATEGORIES } from '@/lib/categories'

interface Props {
  category: string
  onSelect: (emoji: string) => void
}

/** 3-across category grid for the Category picker sheet. */
export function CategorySheetContent({ category, onSelect }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {CATEGORIES.map(cat => {
        const selected = cat.emoji === category
        return (
          <button
            key={cat.emoji} type="button" onClick={() => onSelect(cat.emoji)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '14px 6px', borderRadius: T.r.lg, border: 0, cursor: 'pointer',
              background: selected ? T.sunSoft : T.surfaceAlt,
              boxShadow: selected ? `inset 0 0 0 1.5px ${T.sun}` : 'none',
            }}
          >
            <EmojiTile emoji={cat.emoji} size={40} fontSize={20} background="transparent" />
            <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: selected ? T.sunInk : T.ink, textAlign: 'center' }}>
              {cat.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
