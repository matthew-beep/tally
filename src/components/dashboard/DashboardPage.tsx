import { PADDING_X_BASE } from '@/design/tokens'
import { PullToRefresh } from '@/components/PullToRefresh'

interface DashboardPageProps {
  children: React.ReactNode
  maxWidth?: number
}

/**
 * The scroll body for Groups / Activity / Me. `.page-scroll` is a block
 * container, so PullToRefresh's drag wrapper is layout-neutral here and needs
 * no `contentStyle`.
 */
export function DashboardPage({ children, maxWidth }: DashboardPageProps) {
  return (
    <PullToRefresh
      className="page-scroll"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: `28px ${PADDING_X_BASE}px`,
      }}
    >
      {maxWidth ? (
        <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>{children}</div>
      ) : children}
    </PullToRefresh>
  )
}
