import type { ReactNode } from 'react'

export type WebNavIconName = 'home' | 'groups' | 'activity' | 'me'

interface Props {
  name: WebNavIconName
  color: string
  fill?: boolean
  size?: number
  sw?: number
}

export function WebNavIcon({ name, color, fill = false, size = 19, sw = 1.7 }: Props) {
  const f = fill ? color : 'none'
  const fo = fill ? 0.14 : 0

  const paths: Record<WebNavIconName, ReactNode> = {
    home: (
      <path
        d="M3 10l7-6 7 6v8a1 1 0 01-1 1h-4v-6h-4v6H4a1 1 0 01-1-1v-8z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" fill={f} fillOpacity={fo}
      />
    ),
    groups: (
      <g>
        <circle cx="7" cy="8" r="2.6" stroke={color} strokeWidth={sw} fill={f} fillOpacity={fo} />
        <circle cx="13.5" cy="8" r="2.6" stroke={color} strokeWidth={sw} fill={f} fillOpacity={fo} />
        <path
          d="M2.5 16c0-2.1 2-3.4 4.2-3.4M17.5 16c0-2.1-2-3.4-4.2-3.4M7 16c0-2.3 1.4-3.6 3.2-3.6S13.4 13.7 13.4 16"
          stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      </g>
    ),
    activity: (
      <path
        d="M2.5 10h3l1.6-5 3.2 10 1.6-5H17.5"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
      />
    ),
    me: (
      <g>
        <circle cx="10" cy="7" r="3.2" stroke={color} strokeWidth={sw} fill={f} fillOpacity={fo} />
        <path
          d="M3 17c0-2.8 3.1-4.5 7-4.5s7 1.7 7 4.5"
          stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      </g>
    ),
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      {paths[name]}
    </svg>
  )
}
