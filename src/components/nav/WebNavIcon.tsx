import { Activity, Home, User, Users } from 'lucide-react'

export type WebNavIconName = 'home' | 'groups' | 'activity' | 'me'

const ICONS = {
  home: Home,
  groups: Users,
  activity: Activity,
  me: User,
} as const

interface Props {
  name: WebNavIconName
  color: string
  fill?: boolean
  size?: number
  sw?: number
}

export function WebNavIcon({ name, color, fill = false, size = 19, sw = 1.7 }: Props) {
  const Icon = ICONS[name]
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={sw}
      fill={fill ? color : 'none'}
      fillOpacity={fill ? 0.14 : 0}
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}
