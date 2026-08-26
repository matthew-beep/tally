'use client'

import { Bell } from 'lucide-react'
import { T, FMONO } from '@/design/tokens'
import { Btn } from '@/components/Btn'
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
 *
 * Tactile tier: RAISED, via Btn's `soft` variant — Btn already owns the shadow
 * triple, hover lift and press dip, so this only reshapes the box into the
 * header's circle. Not sun: the header's primary action is the one raised sun
 * object per view. Background is overridden to T.surface (warm white, same as
 * an unselected Token pill) rather than soft's default T.surfaceAlt — reads
 * cleaner against the page than the duller well colour.
 *
 * The badge is a coral bead per the tactile spec — ringed by the page ground so
 * it reads as sitting on top of the bell rather than painted onto it, with the
 * same top-light/drop-shadow the raised tier uses. It was sun (matching the old
 * FNBell design), which is now reserved for the primary action.
 */
export function NotificationBell({ size = 40, onClick }: Props) {
  const { data: notifications = [] } = useNotifications()
  const count = selectActionable(notifications).length

  return (
    <Btn
      variant="soft"
      size="sm"
      onClick={onClick}
      aria-label={count > 0 ? `Notifications, ${count} needing attention` : 'Notifications'}
      icon={<Bell size={Math.round(size * 0.46)} color={T.ink} strokeWidth={1.8} />}
      style={{
        position: 'relative',
        width: size,
        height: size,
        padding: 0,
        gap: 0,
        borderRadius: T.r.pill,
        flexShrink: 0,
        background: T.surface,
      }}
    >
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
            background: T.coral,
            color: T.coralOn,
            fontFamily: FMONO,
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 2px ${T.bg}, inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 2px rgba(31,26,20,0.3)`,
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Btn>
  )
}
