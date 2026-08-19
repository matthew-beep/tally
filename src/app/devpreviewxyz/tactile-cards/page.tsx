'use client'

// Scratch-only route comparing the current elevated card treatment against the
// tactile FLAT tier, so we can decide whether to flatten read-only surfaces app
// wide. Left column = today. Right column = flat. The actionable rows at the
// bottom are identical in both columns on purpose — the question isn't whether
// flat cards look nice on their own, it's whether flattening the information
// makes the tappable things read as tappable. Delete before committing.

import { T, F, FH, FMONO } from '@/design/tokens'
import { Card, CardChevron } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Segmented } from '@/components/Segmented'
import { useTheme } from '@/lib/theme'
import { splitAmount } from '@/lib/money'
import { useState } from 'react'

type Tone = 'elevated' | 'flat'

// The bespoke card surfaces in the app (home hero, people ledger) inline these
// three properties rather than going through <Card>, so mirror that here.
function shell(tone: Tone) {
  return tone === 'flat'
    ? { background: 'transparent', border: 'none', boxShadow: T.shadowHair }
    : { background: T.cardBg, border: T.cardBorder, boxShadow: T.cardShadow }
}

function Amount({ value, color, sign, size }: { value: number; color: string; sign: '+' | '−'; size: number }) {
  const { whole, cents } = splitAmount(value)
  return (
    <span style={{ fontFamily: FH, fontSize: size, fontWeight: 700, letterSpacing: -0.5, color }}>
      <span style={{ opacity: 0.5 }}>{sign}$</span>{whole}
      <span style={{ fontFamily: FMONO, fontSize: size * 0.55, opacity: 0.6 }}>{cents}</span>
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: T.inkFaint }}>
      {children}
    </div>
  )
}

function Surfaces({ tone }: { tone: Tone }) {
  const flat = tone === 'flat'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Home balance hero — the most debatable one */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, padding: '26px 28px 22px', ...shell(tone) }}>
        <Label>Net balance</Label>
        <div style={{ marginTop: 8 }}>
          <Amount value={128.5} color={T.mintInk} sign="+" size={40} />
        </div>
        <div style={{ fontSize: 13, color: T.inkMuted, marginTop: 6 }}>across 4 groups</div>
      </div>

      {/* Groups summary pair */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Card tone={tone} style={{ flex: 1, padding: '16px 18px' }}>
          <Label>You&rsquo;re owed</Label>
          <div style={{ marginTop: 3 }}><Amount value={170.5} color={T.mintInk} sign="+" size={21} /></div>
        </Card>
        <Card tone={tone} style={{ flex: 1, padding: '16px 18px' }}>
          <Label>You owe</Label>
          <div style={{ marginTop: 3 }}><Amount value={42} color={T.coralInk} sign="−" size={21} /></div>
        </Card>
      </div>

      {/* Empty state */}
      <Card tone={tone} style={{ padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: T.mintSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FH, color: T.ink }}>All square</div>
        <div style={{ fontSize: 13, color: T.inkMuted }}>Nobody owes anybody right now.</div>
      </Card>

      {/* Notification rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Card tone={tone} style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, color: T.ink }}>Sam confirmed your payment</div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>$24.00</div>
        </Card>
        <Card tone={tone} style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, color: T.ink }}>Jordan accepted your invite</div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>Big Sur Trip</div>
        </Card>
      </div>

      {/* Actionable — identical in both columns. This is the control. */}
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 11, color: T.inkFaint, marginBottom: 8, fontStyle: 'italic' }}>
          ↓ actionable — unchanged in both columns
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['🌲', 'Big Sur Trip', 128.5], ['🏠', 'Apartment 4B', -42]].map(([emoji, name, net]) => (
            <Card key={name as string} hoverable onClick={() => {}} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px' }}>
              <span style={{ fontSize: 20 }}>{emoji as string}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, fontFamily: F, color: T.ink }}>{name as string}</span>
              <Amount value={Math.abs(net as number)} color={(net as number) >= 0 ? T.mintInk : T.coralInk} sign={(net as number) >= 0 ? '+' : '−'} size={15} />
              <CardChevron />
            </Card>
          ))}
        </div>
      </div>

      {/* The raised object the whole rule exists to protect */}
      <div style={{ paddingTop: 4 }}>
        {flat && (
          <div style={{ fontSize: 11, color: T.inkFaint, marginBottom: 8, fontStyle: 'italic' }}>
            ↓ the one sun object
          </div>
        )}
        <Btn variant="primary" size="lg" fullWidth>Settle up</Btn>
      </div>
    </div>
  )
}

export default function TactileCardsPreview() {
  const { isDark, toggle } = useTheme()
  const [mode, setMode] = useState<'equal' | 'percentage' | 'exact' | 'itemized'>('equal')

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '32px 28px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <h1 style={{ fontFamily: FH, fontSize: 26, fontWeight: 700, letterSpacing: -0.8, color: T.ink }}>
            Flat vs elevated
          </h1>
          <Btn variant="soft" size="sm" onClick={toggle}>{isDark ? '☀️ Light' : '🌙 Dark'}</Btn>
        </div>
        <p style={{ fontSize: 13.5, color: T.inkMuted, maxWidth: 560, lineHeight: 1.5, marginBottom: 28 }}>
          Read-only surfaces only. The group rows and the Settle up button are identical in both
          columns — the question is whether flattening the information around them makes them read
          as the things you can touch.
        </p>

        <div style={{ marginBottom: 28 }}>
          <Label>Segmented control — raised warm-white insert</Label>
          <div style={{ marginTop: 10 }}>
            <Segmented
              options={[
                { value: 'equal', label: 'Equal' },
                { value: 'percentage', label: 'Percent' },
                { value: 'exact', label: 'Exact' },
                { value: 'itemized', label: 'Itemized' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <div>
            <div style={{ marginBottom: 14 }}><Label>Today — elevated</Label></div>
            <Surfaces tone="elevated" />
          </div>
          <div>
            <div style={{ marginBottom: 14 }}><Label>Design — flat</Label></div>
            <Surfaces tone="flat" />
          </div>
        </div>
      </div>
    </div>
  )
}
