'use client'

import { T, FH, AVATAR_SLOTS } from '@/design/tokens'
import type { Profile } from '@/types'
import Image from 'next/image'

interface AvatarProps {
  profile?: Pick<Profile, 'name' | 'display_name' | 'avatar_url'>
  slot?: 0 | 1 | 2 | 3
  size?: number
  isYou?: boolean
}

function initials(profile: Pick<Profile, 'name' | 'display_name'>): string {
  const name = profile.display_name ?? profile.name
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function Avatar({ profile, slot = 0, size = 36, isYou = false }: AvatarProps) {
  const colors = AVATAR_SLOTS[slot % AVATAR_SLOTS.length]
  if (profile?.avatar_url && isYou) {
    return (
      <Image
        src={profile.avatar_url}
        alt={profile.display_name ?? profile.name}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors.bg,
        color: colors.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.33),
        fontWeight: 700,
        fontFamily: FH,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {profile ? initials(profile) : '?'}
    </div>
  )
}

export interface AvatarStackItem {
  profile?: Pick<Profile, 'name' | 'display_name' | 'avatar_url'>
  slot: 0 | 1 | 2 | 3
  isYou?: boolean
  /** Dims the avatar — e.g. a pending group invite. */
  dimmed?: boolean
}

interface AvatarStackProps {
  members: AvatarStackItem[]
  size?: number
  max?: number
  overlap?: number
  /** Ring color around each avatar so overlaps read as separate circles. Match the surface the stack sits on. */
  ringColor?: string
  ringWidth?: number
}

/** Overlapping row of member avatars — group cards, member lists. Each avatar gets a ring so overlaps read as separate circles. */
export function AvatarStack({ members, size = 22, max = 4, overlap = 0.4, ringColor = T.cardBg, ringWidth = 2 }: AvatarStackProps) {
  const shown = members.slice(0, max)
  const extra = members.length - max

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * overlap, zIndex: max - i, borderRadius: '50%', boxShadow: `0 0 0 ${ringWidth}px ${ringColor}`, opacity: m.dimmed ? 0.45 : 1 }}>
          <Avatar profile={m.profile} slot={m.slot} size={size} isYou={m.isYou} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            marginLeft: -size * overlap,
            zIndex: 0,
            width: size,
            height: size,
            borderRadius: '50%',
            background: T.line,
            color: T.inkMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.36),
            fontWeight: 700,
            fontFamily: FH,
            boxShadow: `0 0 0 ${ringWidth}px ${ringColor}`,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
