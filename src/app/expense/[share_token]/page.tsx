import { createServiceRoleClient } from '@/lib/supabase-server'
import { T, FH, FMONO } from '@/design/tokens'

export default async function SharedExpensePage({ params }: { params: Promise<{ share_token: string }> }) {
  const { share_token } = await params
  const supabase = createServiceRoleClient()

  const { data: expense } = await supabase
    .from('expenses')
    .select('*, splits:expense_splits(*, profile:profiles(*)), payer:profiles!paid_by(*), group:groups(name, emoji)')
    .eq('share_token', share_token)
    .single()

  if (!expense) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: T.inkMuted }}>This link is invalid or has expired.</div>
      </div>
    )
  }

  const payer = expense.payer as any
  const group = expense.group as any

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, padding: '40px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{expense.category ?? '💸'}</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FH, letterSpacing: -0.5 }}>{expense.description}</div>
          <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 6 }}>
            {group ? `${group.emoji} ${group.name}` : ''} · {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div style={{ background: T.surface, borderRadius: T.r.lg, boxShadow: '0 2px 14px rgba(31,26,20,0.09)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, paddingBottom: 16, borderBottom: `0.5px solid ${T.line}` }}>
            <div style={{ fontSize: 13, color: T.inkMuted }}>Total paid by {payer?.display_name ?? payer?.name}</div>
            <div style={{ fontFamily: FMONO, fontWeight: 700, fontSize: 20 }}>${Number(expense.amount).toFixed(2)}</div>
          </div>
          {expense.splits?.map((split: any, i: number) => {
            const p = split.profile
            return (
              <div key={split.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < expense.splits.length - 1 ? `0.5px solid ${T.line}` : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{p?.display_name ?? p?.name ?? '…'}</div>
                <div style={{ fontFamily: FMONO, fontSize: 14, fontWeight: 600 }}>${Number(split.owed_amount).toFixed(2)}</div>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: T.inkMuted }}>
          Track your expenses with{' '}
          <span style={{ fontWeight: 700, color: T.ink, fontFamily: FH }}>tally</span>
          {' '}— free, no paywalls.
        </div>
      </div>
    </div>
  )
}
