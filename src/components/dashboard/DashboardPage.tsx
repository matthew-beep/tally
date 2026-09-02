import { PullToRefresh } from '@/components/PullToRefresh'

interface DashboardPageProps {
  children: React.ReactNode
  maxWidth?: number
}

/**
 * The scroll body for Groups / Activity / Me. `.page-scroll` is a block
 * container, so PullToRefresh's drag wrapper is layout-neutral here and needs
 * no `contentStyle`.
 *
 * Padding lives in `.page-scroll` (styles/dashboard.css), NOT here — it has to
 * match `.home-main` at both breakpoints (16px sides + nav clearance on mobile,
 * 28px on desktop) and an inline value would beat the mobile media query.
 */
export function DashboardPage({ children, maxWidth }: DashboardPageProps) {
  return (
    <PullToRefresh
      className="page-scroll"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
      }}
    >
      {maxWidth ? (
        <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>{children}</div>
      ) : children}
    </PullToRefresh>
  )
}
