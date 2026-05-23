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
