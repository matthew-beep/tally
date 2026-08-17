import { PADDING_X_BASE } from '@/design/tokens'

export function DashboardPage({ children, maxWidth }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div className="page-scroll" style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: `28px ${PADDING_X_BASE}px`,
    }}>
      {maxWidth ? (
        <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>{children}</div>
      ) : children}
    </div>
  )
}
