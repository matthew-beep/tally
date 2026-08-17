'use client'

import { Bell } from 'lucide-react'
import { T, FMONO } from '@/design/tokens'
import { useNotifications } from '@/queries/useProfile'
import { selectActionable } from '@/lib/notifications'

interface Props {
  size?: number
  onClick?: () => void
}

/**
 * Icon + badge only — deliberately dumb. Opening the notification center is
 * left to the caller (pair with useNotificationReviewSheet + NotificationsSheet)
 * since where the sheet mounts and what it's nested inside varies by screen.
 * Badge styling matches the design's FNBell exactly (sun/sunInk, not the
 * coral WebNavBadge used for tab-badge attention) — a deliberate deviation
 * from reusing WebNavBadge, since this bell has its own spec.
 */
export function NotificationBell({ size = 40, onClick }: Props) {
  const { data: notifications = [] } = useNotifications()
  const count = selectActionable(notifications).length

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: T.r.pill,
        border: 0,
        background: T.surfaceAlt,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Bell size={Math.round(size * 0.46)} color={T.ink} strokeWidth={1.8} />
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            boxSizing: 'border-box',
            borderRadius: T.r.pill,
            background: T.sun,
            color: T.sunOn,
            fontFamily: FMONO,
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 2px ${T.bg}`,
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
