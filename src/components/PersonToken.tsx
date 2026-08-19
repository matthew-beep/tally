'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { T, F } from '@/design/tokens'
import { Avatar } from '@/components/Avatar'
import { avatarProfile } from '@/lib/memberDisplay'
import { shortName } from '@/components/add-expense/parts'
import type { GroupMember } from '@/types'

export type TokenSize = 'sm' | 'md'

const SIZE = {
  sm: { avatar: 22, fontSize: 12,   padding: '4px 12px 4px 4px', gap: 6, flatPadding: '4px 12px' },
  md: { avatar: 24, fontSize: 13.5, padding: '5px 15px 5px 5px', gap: 8, flatPadding: '5px 15px' },
} as const

interface TokenProps {
  /** Avatar, emoji, or icon shown before the label. Omit for a label-only token. */
  leading?: ReactNode
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  size?: TokenSize
}

/**
 * The app's one selectable-pill shape — the tactile RAISED tier.
 *
 * Unselected is a warm-white token sitting on the surface; selected is the same
 * object in sun. No borders: selection reads as the object changing material,
 * not as a ring drawn around it. Pressing dips it with Btn's timing.
 *
 * Without `onClick` it renders flat (hairline, no elevation) — a pill you can
 * only read is information, and elevation is reserved for things you can touch.
 */
export function Token({ leading, children, selected = false, onClick, size = 'md' }: TokenProps) {
  const [press, setPress] = useState(false)
  const s = SIZE[size]
  const interactive = !!onClick

  const shared = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
    gap: s.gap,
    borderRadius: T.r.pill,
    border: 0,
    fontFamily: F,
    fontSize: s.fontSize,
    fontWeight: 700,
  }

  if (!interactive) {
    return (
      <span style={{
        ...shared,
        padding: leading ? s.padding : s.flatPadding,
        color: T.inkMuted,
        background: 'transparent',
        boxShadow: T.shadowHair,
      }}>
        {leading}
        <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      style={{
        ...shared,
        padding: leading ? s.padding : s.flatPadding,
        cursor: 'pointer',
        color: selected ? T.sunOn : T.inkMuted,
        // Gradient in both states so selecting eases rather than snaps — CSS
        // can't interpolate a gradient to a flat colour.
        background: selected
          ? `linear-gradient(180deg, ${T.sunHi} 0%, ${T.sun} 100%)`
          : `linear-gradient(180deg, ${T.surface} 0%, ${T.surface} 100%)`,
        boxShadow: press ? T.shadowPressed : selected ? T.shadowSun : T.shadowRaised,
        transform: press ? 'translateY(1px)' : 'none',
        transition: 'transform .09s ease, box-shadow .12s ease, background .14s ease, color .14s ease',
      }}
    >
      {leading}
      <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
    </button>
  )
}

interface PersonTokenProps {
  member: GroupMember
  slot: 0 | 1 | 2 | 3
  selected?: boolean
  /** Omit to render a read-only person chip. */
  onClick?: () => void
  youMemberId?: string
  size?: TokenSize
  /** Extra trailing content, e.g. an amount on a read-only split chip. */
  trailing?: ReactNode
}

/** A person as a Token — avatar plus short name. */
export function PersonToken({
  member, slot, selected, onClick, youMemberId, size = 'md', trailing,
}: PersonTokenProps) {
  return (
    <Token
      size={size}
      selected={selected}
      onClick={onClick}
      leading={
        <Avatar
          profile={avatarProfile(member)}
          slot={slot}
          size={SIZE[size].avatar}
          isYou={member.id === youMemberId}
        />
      }
    >
      {shortName(member, youMemberId)}
      {trailing}
    </Token>
  )
}
