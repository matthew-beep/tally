import type { WebNavIconName } from './WebNavIcon'

export const NAV_TABS = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'groups', label: 'Groups', href: '/groups' },
  { id: 'activity', label: 'Activity', href: '/activity' },
  { id: 'me', label: 'Me', href: '/me' },
] as const satisfies readonly { id: WebNavIconName; label: string; href: string }[]

export type TabId = (typeof NAV_TABS)[number]['id']

export function pathnameToTab(pathname: string): TabId {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/groups')) return 'groups'
  if (pathname.startsWith('/activity')) return 'activity'
  if (pathname.startsWith('/me')) return 'me'
  return 'home'
}
