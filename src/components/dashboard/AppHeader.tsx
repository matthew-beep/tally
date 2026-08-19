'use client'

import type { ReactNode } from 'react'
import { T, FH } from '@/design/tokens'
import { Btn } from '@/components/Btn'
import { SectionLabel } from '@/components/SectionLabel'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { NotificationsSheet } from '@/components/notifications/NotificationsSheet'
import { useNotificationReviewSheet } from '@/hooks/useNotificationReviewSheet'
import { useCurrentProfile } from '@/queries/useProfile'
import { useUIStore } from '@/store/ui'
import { firstName } from '@/lib/memberDisplay'

interface AppHeaderAction {
  label: string
  onClick: () => void
  /** Hide below 1024px — for actions a page already surfaces in its own mobile content (e.g. Home's "New group", which Groups covers with its own in-content button). */
  hideOnMobile?: boolean
}

interface AppHeaderProps {
  /** Usually a plain string; pages that need a breadcrumb (e.g. group detail) can pass a node instead. */
  title: ReactNode
  /** Home only: hour-based greeting + first name under the title instead of a plain heading. */
  greeting?: boolean
  /** Defaults to "Add expense" (opens the global AddExpenseGroupPicker), hidden below 1024px since DockedTabBar's center button covers mobile — pass to override. */
  action?: AppHeaderAction
}

/**
 * Persistent header shared by Home/Groups/Activity/Me. Owns its own bell +
 * notification sheet — each mount is independent, no wiring needed by callers.
 */
export function AppHeader({ title, greeting = false, action }: AppHeaderProps) {
  const { data: profile } = useCurrentProfile()
  const notificationSheet = useNotificationReviewSheet()
  const setFabOpen = useUIStore(s => s.setFabOpen)
  const resolvedAction = action ?? { label: 'Add expense', onClick: () => setFabOpen(true), hideOnMobile: true }

  const hour = new Date().getHours()
  const greetingWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="app-header">
      <div>
        {greeting ? (
          <>
            <SectionLabel>{title}</SectionLabel>
            <div className="app-header-greeting" style={{ fontWeight: 700, fontFamily: FH, letterSpacing: -0.5, color: T.ink, marginTop: 1 }}>
              {greetingWord}{profile ? ` ${firstName(profile.display_name ?? profile.name)}` : ''}
            </div>
          </>
        ) : (
          <div className="app-header-title" style={{ fontFamily: FH, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>
            {title}
          </div>
        )}
      </div>

      <div className="app-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn
          variant="primary"
          size="sm"
          onClick={resolvedAction.onClick}
          className={resolvedAction.hideOnMobile ? 'app-header-action app-header-action--hide-mobile' : 'app-header-action'}
        >
          <span className="app-header-action-label">{resolvedAction.label}</span>
          <span className="app-header-action-icon">+</span>
        </Btn>
        <NotificationBell size={34} onClick={notificationSheet.openList} />
      </div>

      <NotificationsSheet open={notificationSheet.open} onClose={notificationSheet.close} initialReview={notificationSheet.initialReview} />
    </div>
  )
}
