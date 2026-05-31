import { T } from '@/design/tokens'

function Bone({ width = '100%', height = 16, radius = 8, style }: {
  width?: string | number
  height?: number
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  )
}

function CardShell({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: T.surface, borderRadius: T.r.lg,
      padding: '20px 22px', boxShadow: T.shadowSm,
      display: 'flex', flexDirection: 'column', gap: 12,
      ...style,
    }}>
      {children}
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="home-hero">
      <CardShell className="home-hero-balance" style={{ minHeight: 110 }}>
        <Bone width={80} height={10} />
        <Bone width={140} height={38} radius={6} />
        <Bone width={160} height={10} />
      </CardShell>

      <div className="home-hero-split">
        <CardShell className="min-w-0">
          <Bone width={90} height={10} />
          <Bone width={100} height={28} radius={6} />
        </CardShell>
        <CardShell className="min-w-0">
          <Bone width={60} height={10} />
          <Bone width={100} height={28} radius={6} />
        </CardShell>
      </div>
    </div>
  )
}

function GroupCardSkeleton() {
  return (
    <CardShell style={{ gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Bone width={40} height={40} radius={T.r.md} />
        <Bone width={56} height={22} radius={T.r.pill} />
      </div>
      <Bone width="60%" height={13} />
      <Bone width={80} height={10} />
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {[0, 1, 2].map(i => (
          <Bone key={i} width={22} height={22} radius={99} />
        ))}
      </div>
    </CardShell>
  )
}

export function GroupsSkeleton() {
  return (
    <div className="home-groups-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Bone width={52} height={10} />
        <Bone width={96} height={32} radius={T.r.md} />
      </div>
      <div className="home-groups-grid">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    </div>
  )
}

export function ActivitySkeleton() {
  return (
    <div className="home-activity-panel">
      <Bone width={100} height={10} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            background: T.surface, borderRadius: T.r.md,
            padding: '11px 14px', display: 'flex', gap: 10,
            alignItems: 'center', boxShadow: T.shadowSm,
          }}>
            <Bone width={34} height={34} radius={T.r.sm} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Bone width="55%" height={11} />
              <Bone width="35%" height={9} />
            </div>
            <Bone width={42} height={13} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HomeScreenSkeleton() {
  return (
    <div className="home-scroll">
      <HeroSkeleton />
      <div className="home-panels">
        <GroupsSkeleton />
        <ActivitySkeleton />
      </div>
    </div>
  )
}
