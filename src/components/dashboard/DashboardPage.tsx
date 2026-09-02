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
 * Padding lives in `.page-scroll` (dashboard.css) rather than inline: it has to
 * change at the mobile breakpoint to match `.home-main`, and an inline value
 * would win over the media query — which is what was previously swallowing the
 * `--tally-nav-clearance` bottom padding too.
 */
export function DashboardPage({ children, maxWidth }: DashboardPageProps) {
  return (
    <PullToRefresh
      className="page-scroll"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      {maxWidth ? (
        <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>{children}</div>
      ) : children}
    </PullToRefresh>
  )
}
