import { T } from '@/design/tokens'

// Loading bones for the home page. Each skeleton mirrors the real component it
// stands in for — same wrapper classes, same paddings, same row heights — so
// the layout doesn't reflow when data lands:
//
//   HeroSkeleton         → HeroCard          (page.tsx)
//   OpenBalancesSkeleton → OpenBalances      (page.tsx) → BalanceTable (desktop)
//   AttentionSkeleton    → GroupInviteCard / SettlementConfirmCard
//   RailActivitySkeleton → ActivityRow
//
// If you change padding/size in one of those, change it here too.

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

/** Matches components/Card.tsx so skeleton cards sit on the same surface. */
function CardShell({ children, style, className }: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div className={className} style={{
      background: T.cardBg,
      border: T.cardBorder,
      borderRadius: T.r.lg,
      boxShadow: T.cardShadow,
      ...style,
    }}>
      {children}
    </div>
  )
}

/** Uppercase section caption (SectionLabel, 11px) + optional trailing action. */
function SectionHeaderSkeleton({ width = 96, action }: { width?: number; action?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
      <Bone width={width} height={10} />
      {action && <Bone width={44} height={10} />}
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────

export function HeroSkeleton() {
  return (
    <CardShell style={{ borderRadius: 22, padding: '26px 30px 22px' }}>
      {/* "Net balance" caption */}
      <Bone width={72} height={9} />
      {/* 52px amount */}
      <Bone width={196} height={46} radius={6} style={{ marginTop: 9 }} />
      {/* owed-to-you / you-owe legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Bone width={7} height={7} radius={99} />
            <Bone width={46} height={13} />
            <Bone width={i === 0 ? 68 : 50} height={10} />
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ── Open balances ──────────────────────────────────────────────────────────

const ROW_WIDTHS = ['52%', '38%', '61%', '45%', '56%'] as const

/** One BalanceTableRow: 30px avatar + name/amount baseline + breakdown lines. */
function BalanceRowSkeleton({ index }: { index: number }) {
  return (
    <div style={{ display: 'flex', gap: 11, padding: '11px 4px' }}>
      <Bone width={30} height={30} radius={99} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Bone width={ROW_WIDTHS[index % ROW_WIDTHS.length]} height={12} />
          <Bone width={44} height={14} />
        </div>
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Bone width={i === 0 ? '58%' : '44%'} height={9} />
              <Bone width={30} height={9} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** One BalanceTableColumn: fixed header rule + rows. */
function BalanceColumnSkeleton({ rows }: { rows: number }) {
  return (
    <div className="balance-table-col">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px 8px', borderBottom: `0.5px solid ${T.line}`,
        marginBottom: 2, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bone width={6} height={6} radius={99} />
          <Bone width={58} height={9} />
          <Bone width={16} height={12} radius={99} />
        </div>
        <Bone width={38} height={11} />
      </div>
      <div className="balance-table-col-list">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ borderTop: i > 0 ? `0.5px solid ${T.line}` : 'none' }}>
            <BalanceRowSkeleton index={i} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mobile counterpart — flat PersonRow cards (padding 14/16, 40px avatar). */
function PersonRowSkeleton({ index }: { index: number }) {
  return (
    <CardShell style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Bone width={40} height={40} radius={99} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bone width={ROW_WIDTHS[index % ROW_WIDTHS.length]} height={12} />
        <Bone width="70%" height={10} />
      </div>
      <Bone width={58} height={22} radius={T.r.pill} />
    </CardShell>
  )
}

export function OpenBalancesSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="home-people">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px', flexShrink: 0 }}>
        <Bone width={104} height={10} />
        <Bone width={20} height={14} radius={99} />
      </div>

      {/* Mobile — flat list of person cards */}
      <div className="home-people-list-mobile">
        {Array.from({ length: rows }, (_, i) => <PersonRowSkeleton key={i} index={i} />)}
      </div>

      {/* Desktop — two-column ledger, columns scroll internally */}
      <CardShell
        className="home-people-card home-people-table-desktop"
        style={{ borderRadius: 20, padding: '18px 22px' }}
      >
        <div className="balance-table">
          <BalanceColumnSkeleton rows={rows} />
          <div className="balance-table-divider" />
          <BalanceColumnSkeleton rows={Math.max(1, rows - 1)} />
        </div>
      </CardShell>
    </div>
  )
}

/** Everything inside .home-main — hero + open balances, same wrapper as loaded. */
export function HomeMainSkeleton() {
  return (
    <div className="home-content" style={{ display: 'flex', flexDirection: 'column', gap: 26, flex: 1, minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <HeroSkeleton />
      </div>
      <OpenBalancesSkeleton />
    </div>
  )
}

// ── Right rail ─────────────────────────────────────────────────────────────

/** Actionable notification cards — GroupInviteCard / SettlementConfirmCard. */
export function AttentionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {Array.from({ length: rows }, (_, i) => (
        <CardShell key={i} style={{ padding: 14 }}>
          <Bone width="88%" height={12} />
          <Bone width="52%" height={12} style={{ marginTop: 6 }} />
          {/* Grid, not flex — Bone is flexShrink: 0 at width 100%, so two of
              them in a flex row would each claim the full width and overflow. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <Bone height={38} radius={T.r.md} />
            <Bone height={38} radius={T.r.md} />
          </div>
        </CardShell>
      ))}
    </div>
  )
}

/**
 * Recent-activity preview rows — ActivityRow (34px tile, 11/14 padding).
 * `rows` should track the limit passed to useAllActivity() on the home page.
 */
export function RailActivitySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{
          background: T.surface, borderRadius: T.r.md,
          padding: '11px 14px', display: 'flex', gap: 10,
          alignItems: 'center', boxShadow: T.shadowSm,
        }}>
          <Bone width={34} height={34} radius={T.r.sm} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Bone width={ROW_WIDTHS[i % ROW_WIDTHS.length]} height={11} />
            <Bone width="34%" height={9} />
          </div>
          <Bone width={42} height={12} />
        </div>
      ))}
    </div>
  )
}

export { SectionHeaderSkeleton }
