'use client'

import { useIsMobileSheet } from '@/hooks/useMediaQuery'
import { EmojiPickerSheet } from '@/components/EmojiPickerSheet'
import { EmojiPopover } from '@/components/EmojiPopover'

interface Props {
  open: boolean
  /** The vocabulary to offer — see src/lib/emoji.ts. */
  emojis: readonly string[]
  /** Currently-held emoji, rendered highlighted. */
  selected?: readonly string[]
  /** Mobile sheet heading. The popover has no room for one and ignores it. */
  title?: string
  /** Required on desktop: the popover anchors to this element. */
  anchorRef: React.RefObject<HTMLElement | null>
  zIndex?: number
  onClose: () => void
  onPick: (emoji: string) => void
}

/**
 * One emoji picker, two presentations — the same split `ModalOrSheet` makes.
 *
 * Mobile (≤767px): full-width bottom sheet, thumb-reachable with big targets.
 * Desktop: a compact popover floating over the button that opened it, since a
 * full-screen sheet with a blurred backdrop is far too much ceremony for
 * putting a 🔥 on a row when the pointer is already on it.
 *
 * Callers pass the same props either way and don't branch themselves.
 */
export function EmojiPicker({ open, emojis, selected, title, anchorRef, zIndex, onClose, onPick }: Props) {
  const isMobile = useIsMobileSheet()

  if (isMobile) {
    return (
      <EmojiPickerSheet
        open={open}
        emojis={emojis}
        selected={selected}
        title={title}
        zIndex={zIndex}
        onClose={onClose}
        onPick={onPick}
      />
    )
  }

  return (
    <EmojiPopover
      open={open}
      emojis={emojis}
      selected={selected}
      anchorRef={anchorRef}
      zIndex={zIndex}
      onClose={onClose}
      onPick={onPick}
    />
  )
}
