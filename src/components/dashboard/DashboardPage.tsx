export function DashboardPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '28px',
    }}>
      {children}
    </div>
  )
}
