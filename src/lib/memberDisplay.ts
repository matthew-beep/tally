import type { Profile } from '@/types'

export type AvatarSource = Pick<Profile, 'name' | 'display_name' | 'avatar_url'>

type MemberNameSource = {
  name: string
  profile?: AvatarSource | null
}

/** Resolve avatar input for any group member row (users and guests). */
export function avatarProfile(m: MemberNameSource): AvatarSource {
  return m.profile ?? { name: m.name, display_name: null, avatar_url: null }
}

/** Display name for any group member row (users and guests). */
export function displayName(m: MemberNameSource): string {
  return m.profile?.display_name ?? m.profile?.name ?? m.name
}

/** First word of a name — for greetings and compact labels. */
export function firstName(name: string): string {
  return name.split(' ')[0]
}
