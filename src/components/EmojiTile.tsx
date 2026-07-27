import { T } from '@/design/tokens'

interface EmojiTileProps {
  emoji: string
  size: number
  fontSize: number
  radius?: number
  background?: string
}

/** Rounded square with a centered emoji — expense category tiles across the feed, activity row, and expense sheet. */
export function EmojiTile({ emoji, size, fontSize, radius = T.r.md, background = T.surfaceAlt }: EmojiTileProps) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, flexShrink: 0 }}>
      {emoji}
    </div>
  )
}
