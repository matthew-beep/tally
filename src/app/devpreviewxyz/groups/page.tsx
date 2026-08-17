'use client'

// Scratch-only route to visually verify the redesigned Groups page (summary
// strip + card-style rows) without needing an authenticated Supabase session.
// Mirrors the real markup in (dashboard)/groups/page.tsx with mock data.
// Delete before committing.

import { T, F, FH, FMONO } from '@/design/tokens'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { AvatarStack } from '@/components/Avatar'
import { splitAmount } from '@/lib/money'

const MOCK_GROUPS = [
  { id: '1', name: 'Big Sur Trip', emoji: '🌲', net: 128.5, activity: 'Jordan added Nepenthe lunch · 2h', members: 4 },
  { id: '2', name: 'Apartment 4B', emoji: '🏠', net: -42.0, activity: 'Riley paid the power bill · yesterday', members: 3 },
  { id: '3', name: 'Ramen crew', emoji: '🍜', net: 18.0, activity: 'You added Pho Bang dinner · Tue', members: 3 },
  { id: '4', name: 'Tahoe weekend', emoji: '🎿', net: -215.75, activity: 'Taylor added lift tickets · 3d', members: 6 },
  { id: '5', name: 'Mia’s birthday', emoji: '🎁', net: 0, activity: 'All settled up · last week', members: 3 },
  { id: '6', name: 'Coffee run', emoji: '☕', net: 4.25, activity: 'You added Blue Bottle · Mon', members: 2 },
]

function SummaryCard({ label, amount, color, sign }: { label: string; amount: number; color: string; sign: '+' | '−' }) {
  const { whole, cents } = splitAmount(amount)
  return (
    <Card tone="elevated" style={{ flex: 1, padding: '13px 15px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.inkFaint }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 21, fontWeight: 700, letterSpacing: -0.5, color, marginTop: 3 }}>
        <span style={{ opacity: 0.7 }}>{sign}$</span>{whole}
        <span style={{ fontFamily: FMONO, fontSize: 13, opacity: 0.6 }}>{cents}</span>
      </div>
    </Card>
  )
}

function SummaryCell({ label, amount, color, sign }: { label: string; amount: number; color: string; sign: '+' | '−' }) {
  const { whole, cents } = splitAmount(amount)
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkFaint }}>{label}</div>
      <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color, marginTop: 4 }}>
        <span style={{ opacity: 0.7 }}>{sign}$</span>{whole}
        <span style={{ fontFamily: FMONO, fontSize: 14, opacity: 0.6 }}>{cents}</span>
      </div>
    </div>
  )
}

function GroupRowAmount({ amount }: { amount: number }) {
  const settled = Math.abs(amount) < 0.01
  const pos = amount > 0
  const { whole, cents } = splitAmount(amount)
  return (
    <div style={{ minWidth: 118, textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.inkFaint }}>
        {settled ? 'settled up' : pos ? "you're owed" : 'you owe'}
      </div>
      <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 700, letterSpacing: -0.4, color: settled ? T.inkFaint : pos ? T.mintInk : T.coralInk, marginTop: 2 }}>
        {settled ? '$0.00' : (
          <>
            <span style={{ opacity: 0.5 }}>{pos ? '+' : '−'}$</span>
            {whole}
            <span style={{ fontFamily: FMONO, fontSize: 12, opacity: 0.6 }}>{cents}</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function GroupsPreviewPage() {
  const owed = MOCK_GROUPS.filter(g => g.net > 0).reduce((s, g) => s + g.net, 0)
  const owe = MOCK_GROUPS.filter(g => g.net < 0).reduce((s, g) => s - g.net, 0)

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: F }}>
      <div style={{ padding: '18px 28px', borderBottom: `1px solid ${T.line}`, fontFamily: FH, fontWeight: 700, fontSize: 24, color: T.ink }}>
        Groups
      </div>
      <div style={{ padding: '28px', maxWidth: 900, margin: '0 auto' }}>
        {/* mobile summary — hidden at >=1024px via .groups-summary-mobile in dashboard.css */}
        <div className="groups-summary-mobile">
          <SummaryCard label="You’re owed" amount={owed} color={T.mintInk} sign="+" />
          <SummaryCard label="You owe" amount={owe} color={T.coralInk} sign="−" />
        </div>

        {/* desktop summary — hidden below 1024px via .groups-summary-desktop in dashboard.css */}
        <Card tone="elevated" className="groups-summary-desktop" style={{ gap: 14, padding: '18px 22px' }}>
          <SummaryCell label="You’re owed" amount={owed} color={T.mintInk} sign="+" />
          <div style={{ width: 1, background: T.line, alignSelf: 'stretch' }} />
          <SummaryCell label="You owe" amount={owe} color={T.coralInk} sign="−" />
          <div style={{ width: 1, background: T.line, alignSelf: 'stretch' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkFaint }}>Active groups</div>
            <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: T.ink, marginTop: 4 }}>{MOCK_GROUPS.length}</div>
          </div>
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: T.surface, borderRadius: 11, padding: '10px 14px', boxShadow: `inset 0 0 0 1px ${T.line}` }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="5.2" stroke={T.inkFaint} strokeWidth="1.6" />
              <path d="M12 12l3.4 3.4" stroke={T.inkFaint} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 13.5, color: T.inkFaint }}>Search groups</span>
          </div>
          <Btn variant="dark" size="md" style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0 }}>+ New group</Btn>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: T.inkFaint, margin: '4px 2px 10px' }}>
          {MOCK_GROUPS.length} groups
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MOCK_GROUPS.map(g => (
            <Card key={g.id} hoverable style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px' }}>
              <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: T.surfaceAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, boxShadow: `inset 0 0 0 1px ${T.line}` }}>
                {g.emoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                  <AvatarStack
                    members={Array.from({ length: g.members }, (_, i) => ({ profile: { name: `Person ${i}`, display_name: null, avatar_url: null }, slot: (i % 4) as 0 | 1 | 2 | 3 }))}
                    size={20}
                    max={4}
                    overlap={0.4}
                  />
                  <span style={{ fontSize: 11.5, color: T.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.activity}</span>
                </div>
              </div>
              <GroupRowAmount amount={g.net} />
              <svg width="7" height="12" viewBox="0 0 7 12" style={{ flexShrink: 0 }}>
                <path d="M1 1l5 5-5 5" fill="none" stroke={T.inkFaint} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
