// style-guide.jsx — Tally design system docs page

const SG = (() => {
  const t = TallyTokens.light;
  return t;
})();

// ─── Sidebar nav structure ──────────────────────────────────────────────
const NAV = [
  { group: 'Overview', items: [{ id: 'overview', label: 'Tally' }] },
  { group: 'Foundations', items: [
    { id: 'brand',     label: 'Brand' },
    { id: 'color',     label: 'Color' },
    { id: 'type',      label: 'Typography' },
    { id: 'spacing',   label: 'Spacing & radius' },
    { id: 'elevation', label: 'Elevation' },
    { id: 'iconography', label: 'Iconography' },
  ]},
  { group: 'Components', items: [
    { id: 'avatars',   label: 'Avatars' },
    { id: 'buttons',   label: 'Buttons' },
    { id: 'pills',     label: 'Pills & chips' },
    { id: 'cards',     label: 'Cards' },
    { id: 'inputs',    label: 'Inputs' },
    { id: 'receipt',   label: 'Receipt block' },
    { id: 'sheet',     label: 'Bottom sheet' },
    { id: 'tabbar',    label: 'Tab bar' },
  ]},
  { group: 'Money', items: [
    { id: 'money',     label: 'Numbers & balances' },
  ]},
  { group: 'Patterns', items: [
    { id: 'dual-mode',  label: 'Dual-mode entry' },
    { id: 'auto-cat',   label: 'Auto-categorize' },
    { id: 'principles', label: 'Principles' },
  ]},
];

// ─── Layout primitives ──────────────────────────────────────────────────
function Section({ id, eyebrow, title, lede, children, anchor }) {
  return (
    <section id={id} style={{
      padding: '72px 0 12px',
      borderTop: id === 'overview' ? 'none' : `0.5px solid ${SG.line}`,
      scrollMarginTop: 20,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
        color: SG.inkMuted, marginBottom: 8,
      }}>{eyebrow}</div>
      <h2 style={{
        margin: 0,
        fontFamily: '"Bricolage Grotesque", system-ui',
        fontSize: 40, fontWeight: 600, letterSpacing: -1.4, lineHeight: 1.05,
        color: SG.ink,
      }}>{title}</h2>
      {lede && (
        <p style={{
          marginTop: 14, marginBottom: 0,
          maxWidth: 680, fontSize: 16, lineHeight: 1.55, color: SG.inkMuted,
        }}>{lede}</p>
      )}
      <div style={{ marginTop: 36 }}>{children}</div>
    </section>
  );
}

function Sub({ title, hint, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        marginBottom: 14,
      }}>
        <h3 style={{
          margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: SG.ink,
        }}>{title}</h3>
        {hint && <div style={{ fontSize: 12, color: SG.inkMuted, fontFamily: '"JetBrains Mono", monospace' }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Card({ children, pad = 24, style = {} }) {
  return (
    <div style={{
      background: SG.surface, borderRadius: 22, padding: pad,
      boxShadow: '0 1px 0 rgba(31,26,20,0.04)',
      ...style,
    }}>{children}</div>
  );
}

function Mono({ children, dim }) {
  return <span style={{
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 11, fontWeight: 600,
    color: dim ? SG.inkFaint : SG.inkMuted,
  }}>{children}</span>;
}

function Token({ name }) {
  return <code style={{
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 11.5, fontWeight: 600,
    color: SG.ink,
    background: SG.surfaceAlt,
    padding: '1px 6px', borderRadius: 5,
    border: `0.5px solid ${SG.line}`,
  }}>{name}</code>;
}

// ─── TOP-LEVEL LAYOUT ───────────────────────────────────────────────────
function StyleGuide() {
  // Highlight active anchor based on scroll
  const [active, setActive] = React.useState('overview');
  React.useEffect(() => {
    function onScroll() {
      const ids = NAV.flatMap(g => g.items.map(i => i.id));
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top < 120) cur = id;
      }
      setActive(cur);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{
      maxWidth: 1320, margin: '0 auto', padding: '0 32px',
      display: 'grid', gridTemplateColumns: '220px 1fr',
      gap: 56,
    }}>
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside style={{
        position: 'sticky', top: 0, alignSelf: 'flex-start',
        height: '100vh', overflowY: 'auto',
        padding: '32px 0 32px',
      }}>
        <a href="#overview" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 18px',
          textDecoration: 'none', color: 'inherit',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 11,
            background: SG.sun, color: SG.sunInk,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15,
            fontFamily: '"Bricolage Grotesque", system-ui', letterSpacing: -0.5,
          }}>T</div>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1,
              fontFamily: '"Bricolage Grotesque", system-ui',
            }}>tally</div>
            <div style={{ fontSize: 10.5, color: SG.inkMuted, marginTop: 3 }}>design system · v0.2</div>
          </div>
        </a>

        {NAV.map(group => (
          <div key={group.group} style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              color: SG.inkFaint, padding: '4px 10px 6px',
            }}>{group.group}</div>
            {group.items.map(item => {
              const isActive = active === item.id;
              return (
                <a key={item.id} href={`#${item.id}`} style={{
                  display: 'block', padding: '6px 10px', borderRadius: 8,
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? SG.ink : SG.inkMuted,
                  background: isActive ? SG.surface : 'transparent',
                  textDecoration: 'none',
                  marginBottom: 1,
                  boxShadow: isActive ? '0 1px 0 rgba(31,26,20,0.04)' : 'none',
                }}>{item.label}</a>
              );
            })}
          </div>
        ))}

        <div style={{
          marginTop: 20, padding: '10px 12px', borderRadius: 12,
          background: SG.surfaceAlt, fontSize: 11, color: SG.inkMuted, lineHeight: 1.5,
        }}>
          Open <a href="Tally.html" style={{ color: SG.ink, fontWeight: 700 }}>Tally.html</a> to see every component in context.
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────── */}
      <main style={{ padding: '32px 0 120px', maxWidth: 920 }}>
        {/* Cover */}
        <section id="overview" style={{ paddingTop: 16, scrollMarginTop: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
            color: SG.inkMuted,
          }}>Tally · Design system</div>
          <h1 style={{
            margin: '10px 0 0',
            fontFamily: '"Bricolage Grotesque", system-ui',
            fontSize: 72, fontWeight: 600, letterSpacing: -3.2, lineHeight: 0.95,
          }}>Friendly,<br/>fast,<br/>paid up.</h1>
          <p style={{
            marginTop: 22, fontSize: 18, lineHeight: 1.55, color: SG.inkMuted, maxWidth: 620,
          }}>
            The tokens, components, and patterns behind Tally — a PWA for splitting costs with
            friends. Two modes: <b style={{ color: SG.ink }}>Groups</b> for the people you spend
            with regularly, <b style={{ color: SG.ink }}>Quick Split</b> for the bill in front of
            you right now.
          </p>

          {/* meta strip */}
          <div style={{
            marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
          }}>
            {[
              ['Version',   'v0.2 · 21 May 2026'],
              ['Surfaces',  'iOS PWA · Web'],
              ['Type',      '3 families'],
              ['Components','22 documented'],
            ].map(([k, v]) => (
              <div key={k} style={{
                padding: '14px 16px', background: SG.surface, borderRadius: 14,
                boxShadow: '0 1px 0 rgba(31,26,20,0.04)',
              }}>
                <div style={{ fontSize: 10.5, color: SG.inkMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{k}</div>
                <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </section>

        <SectionBrand/>
        <SectionColor/>
        <SectionType/>
        <SectionSpacing/>
        <SectionElevation/>
        <SectionIconography/>

        <SectionAvatars/>
        <SectionButtons/>
        <SectionPills/>
        <SectionCards/>
        <SectionInputs/>
        <SectionReceipt/>
        <SectionSheet/>
        <SectionTabbar/>

        <SectionMoney/>

        <SectionDualMode/>
        <SectionAutoCat/>
        <SectionPrinciples/>
      </main>
    </div>
  );
}

// ─── 1. BRAND ───────────────────────────────────────────────────────────
function SectionBrand() {
  return (
    <Section
      id="brand" eyebrow="Foundations · 01"
      title="Brand"
      lede="Tally is warm but not cute, plainspoken but not flat. The mark is a soft T tile in our sun color, paired with a lowercase Bricolage wordmark. Money apps usually feel clinical; this one should feel like a friend offering to do the math.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card pad={36}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 84, height: 84, borderRadius: 26,
              background: SG.sun, color: SG.sunInk,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 44,
              fontFamily: '"Bricolage Grotesque", system-ui', letterSpacing: -1.5,
              boxShadow: `0 6px 0 ${SG.bg}, 0 6px 0 0.5px ${SG.lineStrong}`,
            }}>T</div>
            <div>
              <div style={{
                fontFamily: '"Bricolage Grotesque", system-ui',
                fontSize: 64, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1,
              }}>tally</div>
              <div style={{ fontSize: 13, color: SG.inkMuted, marginTop: 6 }}>split costs with friends</div>
            </div>
          </div>
          <div style={{
            display: 'flex', gap: 6, marginTop: 24, fontSize: 11, color: SG.inkMuted,
          }}>
            <Token>logo.tile</Token>
            <Token>wordmark.lowercase</Token>
          </div>
        </Card>

        <Card pad={28}>
          <Sub title="Voice principles">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Plain about money', 'Say "you owe Sam $24", not "you have an outstanding balance".'],
                ['Never punitive',    'Owe states are coral, not red. We don\u2019t do scolding.'],
                ['Warm, not cute',    'No emoji stuffing in body copy. Emojis live with categories and groups.'],
                ['Numbers first',     'Amounts are always the largest thing on screen.'],
              ].map(([h, b]) => (
                <li key={h} style={{ display: 'flex', gap: 10 }}>
                  <span style={{
                    flexShrink: 0, width: 6, height: 6, borderRadius: '50%',
                    background: SG.sun, marginTop: 8,
                  }}/>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{h}</div>
                    <div style={{ fontSize: 12.5, color: SG.inkMuted, marginTop: 2, lineHeight: 1.45 }}>{b}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Sub>
        </Card>
      </div>
    </Section>
  );
}

// ─── 2. COLOR ───────────────────────────────────────────────────────────
function SectionColor() {
  const groups = [
    { label: 'Surfaces',  keys: ['bg', 'surface', 'surfaceAlt'] },
    { label: 'Ink',       keys: ['ink', 'inkMuted', 'inkFaint'] },
    { label: 'Lines',     keys: ['line', 'lineStrong'] },
    { label: 'Semantic',  keys: ['mint', 'mintSoft', 'mintInk', 'coral', 'coralSoft', 'coralInk'] },
    { label: 'Brand',     keys: ['sun', 'sunSoft', 'sunInk', 'lavender'] },
  ];
  const notes = {
    mint:   'Owed to you — gentle green',
    coral:  'You owe — warm peach, never red',
    sun:    'Primary CTA, FAB, brand mark',
    lavender:'The bridge between modes',
    bg:     'Warm cream — never pure white',
    surface:'Card background — clean white',
    surfaceAlt:'Sub-card / footer wells',
  };
  return (
    <Section
      id="color" eyebrow="Foundations · 02"
      title="Color"
      lede="One warm cream base, two clean surface tones, semantic mint/coral for direction-of-debt, and sun as the brand accent. Lavender appears anywhere we bridge the two modes. Light and dark palettes are paired one-to-one.">
      <Sub title="Light & dark" hint="paired tokens">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[['Light', TallyTokens.light, '#F4EEE3'], ['Dark', TallyTokens.dark, '#181410']].map(([label, palette, bg]) => (
            <div key={label} style={{
              background: bg, borderRadius: 18, padding: 18,
              border: label === 'Dark' ? `0.5px solid ${SG.lineStrong}` : 'none',
              boxShadow: label === 'Light' ? '0 1px 0 rgba(31,26,20,0.04)' : 'none',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
                color: label === 'Dark' ? palette.inkMuted : SG.inkMuted, marginBottom: 12,
              }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {['bg','surface','ink','mint','coral','sun','lavender','surfaceAlt','inkMuted'].map(k => (
                  <div key={k}>
                    <div style={{
                      width: '100%', aspectRatio: '1.6',
                      borderRadius: 10, background: palette[k],
                      boxShadow: `inset 0 0 0 0.5px ${label === 'Dark' ? palette.lineStrong : SG.lineStrong}`,
                    }}/>
                    <div style={{
                      fontSize: 10, fontWeight: 700, marginTop: 4,
                      color: label === 'Dark' ? palette.ink : SG.ink,
                    }}>{k}</div>
                    <div style={{
                      fontSize: 9.5, fontFamily: '"JetBrains Mono", monospace',
                      color: label === 'Dark' ? palette.inkFaint : SG.inkFaint,
                    }}>{typeof palette[k] === 'string' && palette[k][0] === '#' ? palette[k].toUpperCase() : 'rgba'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sub>

      <Sub title="Token reference" hint="usage notes">
        <div style={{
          background: SG.surface, borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 1px 0 rgba(31,26,20,0.04)',
        }}>
          {groups.map((g, gi) => (
            <React.Fragment key={g.label}>
              <div style={{
                padding: '12px 18px 8px',
                background: SG.surfaceAlt,
                borderTop: gi === 0 ? 'none' : `0.5px solid ${SG.line}`,
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: SG.inkMuted,
              }}>{g.label}</div>
              {g.keys.map(k => {
                const c = TallyTokens.light[k];
                return (
                  <div key={k} style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 130px 1fr',
                    gap: 14, alignItems: 'center',
                    padding: '10px 18px',
                    borderTop: `0.5px solid ${SG.line}`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: c,
                      boxShadow: `inset 0 0 0 0.5px ${SG.lineStrong}`,
                    }}/>
                    <Token>{k}</Token>
                    <Mono>{typeof c === 'string' && c[0] === '#' ? c.toUpperCase() : c}</Mono>
                    <div style={{ fontSize: 12.5, color: SG.inkMuted }}>{notes[k] || '—'}</div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </Sub>
    </Section>
  );
}

// ─── 3. TYPE ────────────────────────────────────────────────────────────
function SectionType() {
  const families = [
    { name: 'Bricolage Grotesque',  use: 'Display · headings · amounts', stack: '"Bricolage Grotesque", system-ui', weight: 600, sample: '+$1,247.50' },
    { name: 'Plus Jakarta Sans',    use: 'UI body · labels · names',    stack: '"Plus Jakarta Sans", system-ui',    weight: 600, sample: 'Big Sur Trip · 4 people' },
    { name: 'JetBrains Mono',       use: 'Tabular · metadata · code',   stack: '"JetBrains Mono", monospace',       weight: 600, sample: '8.625% · proportional' },
  ];
  const scale = [
    { px: 64, role: 'Hero numbers', sample: '$143', font: 'Bricolage' },
    { px: 44, role: 'Section H1',   sample: 'Quick split', font: 'Bricolage' },
    { px: 30, role: 'Screen title', sample: "Who's here?", font: 'Bricolage' },
    { px: 22, role: 'Card title',   sample: 'Big Sur Trip', font: 'Bricolage' },
    { px: 18, role: 'Subsection',   sample: 'Recent activity', font: 'Bricolage' },
    { px: 15, role: 'Body lead',    sample: 'A bill at the table. No accounts needed.', font: 'Jakarta' },
    { px: 13, role: 'Body',         sample: "Nepenthe lunch · yesterday", font: 'Jakarta' },
    { px: 11, role: 'Eyebrow',      sample: 'AUTO · CATEGORY', font: 'Jakarta', mono: false },
    { px: 11, role: 'Mono caption', sample: '$108.89 + 8.625% tax', font: 'JetBrains', mono: true },
  ];

  return (
    <Section
      id="type" eyebrow="Foundations · 03"
      title="Typography"
      lede="Three families do three jobs. Bricolage carries the amounts and the warmth. Plus Jakarta runs the UI without drawing attention to itself. JetBrains Mono shows up for any number that needs to align in a column.">
      <Sub title="Families">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {families.map(f => (
            <Card key={f.name} pad={20}>
              <div style={{
                fontFamily: f.stack, fontWeight: f.weight,
                fontSize: f.name === 'JetBrains Mono' ? 26 : 30,
                letterSpacing: -0.8, lineHeight: 1.05, marginBottom: 12,
                color: SG.ink,
              }}>{f.sample}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: SG.ink }}>{f.name}</div>
              <div style={{ fontSize: 11.5, color: SG.inkMuted, marginTop: 3 }}>{f.use}</div>
              <div style={{
                marginTop: 12,
                fontFamily: f.stack, fontSize: 14, color: SG.inkMuted,
                letterSpacing: 0,
              }}>
                Aa Bb Cc 0123 — ↑↓
              </div>
            </Card>
          ))}
        </div>
      </Sub>

      <Sub title="Scale">
        <Card pad={0}>
          {scale.map((s, i) => (
            <div key={s.role} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 140px 90px',
              alignItems: 'center', gap: 18,
              padding: '14px 20px',
              borderTop: i === 0 ? 'none' : `0.5px solid ${SG.line}`,
            }}>
              <Mono>{s.px}px</Mono>
              <div style={{
                fontFamily: s.mono ? '"JetBrains Mono", monospace' :
                            s.font === 'Bricolage' ? '"Bricolage Grotesque", system-ui' :
                            '"Plus Jakarta Sans", system-ui',
                fontSize: s.px, fontWeight: 600, lineHeight: 1.1,
                letterSpacing: s.px > 20 ? -0.8 : -0.2,
                color: SG.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{s.sample}</div>
              <div style={{ fontSize: 12, color: SG.inkMuted }}>{s.role}</div>
              <Mono dim>{s.font}</Mono>
            </div>
          ))}
        </Card>
      </Sub>
    </Section>
  );
}

// ─── 4. SPACING & RADIUS ────────────────────────────────────────────────
function SectionSpacing() {
  const space = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
  const radius = [
    { px: 6,  use: 'inline tags' },
    { px: 8,  use: 'icon buttons' },
    { px: 10, use: 'nav items' },
    { px: 12, use: 'small buttons, inputs' },
    { px: 14, use: 'medium cards' },
    { px: 16, use: 'tab bar, large buttons' },
    { px: 18, use: 'list cards' },
    { px: 20, use: 'panel cards' },
    { px: 22, use: 'hero cards' },
    { px: 999, use: 'pills · circular' },
  ];
  return (
    <Section
      id="spacing" eyebrow="Foundations · 04"
      title="Spacing & radius"
      lede="Spacing leans on a soft 4-step scale up to 32, with generous 18–22 radii on most cards. Pills and avatars stay perfectly round.">
      <Sub title="Spacing scale" hint="px">
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            {space.map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 12, height: n, background: SG.sun, borderRadius: 2,
                  boxShadow: `0 0 0 0.5px ${SG.lineStrong}`,
                }}/>
                <Mono>{n}</Mono>
              </div>
            ))}
          </div>
        </Card>
      </Sub>

      <Sub title="Radius scale">
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {radius.map(r => (
              <div key={r.px} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 64, height: 64,
                  borderRadius: r.px === 999 ? 999 : r.px,
                  background: SG.sunSoft,
                  border: `1px solid ${SG.sun}`,
                }}/>
                <Mono>{r.px === 999 ? '999 / ∞' : `${r.px}px`}</Mono>
                <div style={{ fontSize: 10.5, color: SG.inkMuted, textAlign: 'center' }}>{r.use}</div>
              </div>
            ))}
          </div>
        </Card>
      </Sub>
    </Section>
  );
}

// ─── 5. ELEVATION ───────────────────────────────────────────────────────
function SectionElevation() {
  const levels = [
    { name: 'Resting',  shadow: 'none', extra: '0.5px line in dark mode', use: 'Inside a section, on the cream bg.' },
    { name: 'Lifted',   shadow: '0 1px 0 rgba(31,26,20,0.04)',           use: 'Default card on cream.' },
    { name: 'Floating', shadow: '0 8px 24px rgba(0,0,0,0.08)',           use: 'Tab bar, sticky receipt panel.' },
    { name: 'Modal',    shadow: '0 30px 80px rgba(0,0,0,0.28)',          use: 'Add-expense modal, sheet over content.' },
  ];
  return (
    <Section
      id="elevation" eyebrow="Foundations · 05"
      title="Elevation"
      lede="Most surfaces sit flat — Tally is a flat-but-warm app, not a glassmorphism app. Shadows only show up when something is genuinely floating above the content.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {levels.map(l => (
          <div key={l.name} style={{
            background: SG.bg, padding: 18, borderRadius: 18,
            border: `0.5px solid ${SG.line}`,
          }}>
            <div style={{
              width: '100%', height: 72,
              background: SG.surface, borderRadius: 14,
              boxShadow: l.shadow,
            }}/>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12 }}>{l.name}</div>
            <Mono>{l.shadow === 'none' ? '—' : 'shadow'}</Mono>
            <div style={{ fontSize: 11, color: SG.inkMuted, marginTop: 6, lineHeight: 1.4 }}>{l.use}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── 6. ICONOGRAPHY ─────────────────────────────────────────────────────
function SectionIconography() {
  const ico = (path, sw = 1.8) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{path(sw)}</svg>
  );
  const icons = [
    ['home',     (sw) => <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-7h-4v7H5a1 1 0 01-1-1v-9z" stroke={SG.ink} strokeWidth={sw} strokeLinejoin="round"/>],
    ['groups',   (sw) => <><circle cx="8" cy="9" r="3" stroke={SG.ink} strokeWidth={sw}/><circle cx="16" cy="9" r="3" stroke={SG.ink} strokeWidth={sw}/><path d="M3 19c0-2.5 2.5-4 5-4s5 1.5 5 4M11 19c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round"/></>],
    ['activity', (sw) => <path d="M3 12h4l2-6 4 12 2-6h6" stroke={SG.ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>],
    ['me',       (sw) => <><circle cx="12" cy="8" r="4" stroke={SG.ink} strokeWidth={sw}/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round"/></>],
    ['search',   (sw) => <><circle cx="10" cy="10" r="6" stroke={SG.ink} strokeWidth={sw}/><path d="M15 15l5 5" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round"/></>],
    ['back',     (sw) => <path d="M14 5l-7 7 7 7" stroke={SG.ink} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round"/>],
    ['close',    (sw) => <path d="M5 5l14 14M19 5L5 19" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round"/>],
    ['plus',     (sw) => <path d="M12 5v14M5 12h14" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round"/>],
    ['camera',   (sw) => <><rect x="3" y="6" width="18" height="14" rx="2" stroke={SG.ink} strokeWidth={sw}/><circle cx="12" cy="13" r="4" stroke={SG.ink} strokeWidth={sw}/><rect x="9" y="3" width="6" height="3" rx="1" fill={SG.ink}/></>],
    ['receipt',  (sw) => <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4" stroke={SG.ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>],
    ['share',    (sw) => <path d="M12 3v12M8 7l4-4 4 4M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>],
    ['sparkle',  (sw) => <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke={SG.ink} strokeWidth={sw} strokeLinejoin="round"/>],
    ['clock',    (sw) => <><circle cx="12" cy="12" r="9" stroke={SG.ink} strokeWidth={sw}/><path d="M12 7v5l3 2" stroke={SG.ink} strokeWidth={sw} strokeLinecap="round"/></>],
    ['lock',     (sw) => <><rect x="5" y="11" width="14" height="9" rx="2" stroke={SG.ink} strokeWidth={sw}/><path d="M8 11V8a4 4 0 018 0v3" stroke={SG.ink} strokeWidth={sw}/></>],
  ];
  return (
    <Section
      id="iconography" eyebrow="Foundations · 06"
      title="Iconography"
      lede="Stroke icons at 1.8px on a 24px grid. Rounded line-caps. Filled forms only when an icon represents a piece of fixed data (avatar initials, emoji categories).">
      <Card>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12,
        }}>
          {icons.map(([name, path]) => (
            <div key={name} style={{
              padding: '14px 8px 10px', borderRadius: 12,
              background: SG.bg, textAlign: 'center',
            }}>
              {ico(path)}
              <div style={{ fontSize: 10, color: SG.inkMuted, marginTop: 6, fontFamily: '"JetBrains Mono", monospace' }}>{name}</div>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
}

// ─── 7. AVATARS ─────────────────────────────────────────────────────────
function SectionAvatars() {
  return (
    <Section
      id="avatars" eyebrow="Components · 01"
      title="Avatars"
      lede="One letter, one color, one circle. Each Tally person owns a hue from the palette so they read consistently across screens. No photos for now — names alone do the work.">
      <Sub title="Sizes" hint="14–56 · same proportions">
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            {[14, 20, 22, 26, 30, 36, 42, 56].map(s => (
              <div key={s} style={{ textAlign: 'center' }}>
                <Avatar id="sam" size={s}/>
                <div style={{ marginTop: 6 }}><Mono>{s}</Mono></div>
              </div>
            ))}
          </div>
        </Card>
      </Sub>

      <Sub title="States">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {[
              { label: 'Default',  el: <Avatar id="sam" size={42}/> },
              { label: 'Dimmed',   el: <Avatar id="sam" size={42} dimmed/> },
              { label: 'Ringed',   el: <Avatar id="sam" size={42} ring/> },
              { label: 'Stack',    el: <AvatarStack ids={['you','sam','taylor','jordan','riley']} size={32} max={4}/> },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                {s.el}
                <div style={{ fontSize: 12, color: SG.inkMuted, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </Sub>

      <Sub title="Person colors">
        <Card>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {PEOPLE.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar id={p.id} size={32}/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                  <Mono>{p.color.toUpperCase()}</Mono>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Sub>
    </Section>
  );
}

// ─── 8. BUTTONS ─────────────────────────────────────────────────────────
function SectionButtons() {
  return (
    <Section
      id="buttons" eyebrow="Components · 02"
      title="Buttons"
      lede="Ink for confirmation, sun for the brand moment, ghost for secondary actions. Only one ink button per screen — it's where the eye should go.">
      <Sub title="Variants">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button style={btnInk()}>Save expense</button>
            <button style={btnSun()}>Save expense</button>
            <button style={btnGhost()}>Cancel</button>
            <button style={btnDashed()}>+ Add item</button>
            <button style={btnIcon()}>
              <svg width="16" height="16" viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6" stroke={SG.ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button style={btnFAB()}>+</button>
          </div>
          <div style={{
            marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8,
            fontSize: 10.5, fontWeight: 600, color: SG.inkMuted, textAlign: 'center',
          }}>
            {['Ink (primary)','Sun (brand)','Ghost','Dashed','Icon','FAB'].map(l => <div key={l}>{l}</div>)}
          </div>
        </Card>
      </Sub>

      <Sub title="When to use">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { swatch: btnInk(),  l: 'Ink', d: "The confirmation. \u201CSave expense\u201D, \u201CContinue with Quick Split\u201D, \u201CSend everyone their share\u201D." },
            { swatch: btnSun(),  l: 'Sun', d: 'The brand moment. Mode chooser, FAB context. Use sparingly — it loses meaning if everything is sun.' },
            { swatch: btnGhost(),l: 'Ghost', d: '"Search", "Save to group", "Scan receipt". Anything that\'s the second-most-important action.' },
            { swatch: btnDashed(),l: 'Dashed', d: '"+ Start a new group", "+ Add person". Lightweight, suggests open-endedness.' },
          ].map(b => (
            <Card key={b.l} pad={18}>
              <button style={{...b.swatch, marginBottom: 12, fontSize: 13 }}>
                {b.l === 'Dashed' ? '+ Add' : (b.l === 'Ghost' ? 'Action' : 'Action')}
              </button>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{b.l}</div>
              <div style={{ fontSize: 12, color: SG.inkMuted, lineHeight: 1.5 }}>{b.d}</div>
            </Card>
          ))}
        </div>
      </Sub>
    </Section>
  );
}

const btnInk = () => ({
  padding: '10px 18px', borderRadius: 12,
  background: SG.ink, color: SG.bg, border: 0, cursor: 'pointer',
  font: 'inherit', fontSize: 14, fontWeight: 700,
});
const btnSun = () => ({
  padding: '10px 18px', borderRadius: 12,
  background: SG.sun, color: SG.sunInk, border: 0, cursor: 'pointer',
  font: 'inherit', fontSize: 14, fontWeight: 700,
  boxShadow: '0 4px 12px rgba(242,192,74,0.35)',
});
const btnGhost = () => ({
  padding: '10px 16px', borderRadius: 12,
  background: SG.surface, color: SG.ink,
  border: `0.5px solid ${SG.lineStrong}`, cursor: 'pointer',
  font: 'inherit', fontSize: 13.5, fontWeight: 600,
});
const btnDashed = () => ({
  padding: '8px 14px', borderRadius: 999,
  background: 'transparent', color: SG.inkMuted,
  border: `1.5px dashed ${SG.lineStrong}`, cursor: 'pointer',
  font: 'inherit', fontSize: 13, fontWeight: 600,
});
const btnIcon = () => ({
  width: 36, height: 36, borderRadius: 12,
  background: SG.surface, border: `0.5px solid ${SG.line}`,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const btnFAB = () => ({
  width: 54, height: 54, borderRadius: 18,
  background: SG.sun, color: SG.sunInk,
  border: 0, cursor: 'pointer',
  fontSize: 28, fontWeight: 500, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: '"Bricolage Grotesque", system-ui',
  boxShadow: `0 8px 20px rgba(242,192,74,0.5)`,
});

// ─── 9. PILLS ───────────────────────────────────────────────────────────
function SectionPills() {
  return (
    <Section
      id="pills" eyebrow="Components · 03"
      title="Pills & chips"
      lede="The unit of UI throughout Tally — categories, people, statuses, filters. Round, compact, scannable.">
      <Sub title="Category pills">
        <Card>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.slice(0, 10).map((c, i) => (
              <div key={c.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px 5px 8px', borderRadius: 999,
                background: i === 0 ? SG.ink : SG.bg,
                color: i === 0 ? SG.bg : SG.ink,
                fontSize: 12, fontWeight: 600,
                position: 'relative',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{c.emoji}</span>
                {c.label}
                {i === 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 12, height: 12, borderRadius: '50%',
                    background: SG.sun, color: SG.sunInk,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, boxShadow: `0 0 0 1.5px ${SG.surface}`,
                  }}>✨</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </Sub>

      <Sub title="Person pills">
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['you','sam','taylor','jordan','riley'].map((id, i) => {
              const p = PERSON_BY_ID[id];
              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 12px 5px 4px', borderRadius: 999,
                  background: i === 0 ? p.color : SG.bg,
                }}>
                  <Avatar id={id} size={24}/>
                  <span style={{ fontSize: 13, fontWeight: 600, color: SG.ink }}>{p.name}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </Sub>

      <Sub title="Status pills">
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Status bg={SG.mintSoft} fg={SG.mintInk}>paid</Status>
            <Status bg={SG.bg} fg={SG.inkMuted}>square ✓</Status>
            <Status bg={SG.sunSoft} fg={SG.sunInk}><svg width="9" height="9" viewBox="0 0 12 12" style={{marginRight:4}}><path d="M6 1l1.2 3.3L10.5 5.5l-3.3 1.2L6 10l-1.2-3.3L1.5 5.5l3.3-1.2L6 1z" fill="currentColor"/></svg>Auto</Status>
            <Status bg={SG.coralSoft} fg={SG.coralInk}>overdue</Status>
            <Status bg={SG.mintSoft} fg={SG.mintInk}>FREE</Status>
            <Status bg={SG.lavender + '33'} fg={SG.ink}>↔ saved to group</Status>
          </div>
        </Card>
      </Sub>

      <Sub title="Segmented filter">
        <Card>
          <div style={{
            display: 'inline-flex', gap: 2, background: SG.surface, padding: 3,
            borderRadius: 10, boxShadow: `inset 0 0 0 0.5px ${SG.line}`,
          }}>
            {['All', 'Owed', 'You owe'].map((l, i) => (
              <button key={l} style={{
                border: 0, padding: '6px 14px', borderRadius: 7,
                fontSize: 12, fontWeight: 700,
                background: i === 0 ? SG.ink : 'transparent',
                color: i === 0 ? SG.bg : SG.inkMuted,
                cursor: 'pointer', font: 'inherit',
              }}>{l}</button>
            ))}
          </div>
        </Card>
      </Sub>
    </Section>
  );
}

function Status({ children, bg, fg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
    }}>{children}</span>
  );
}

// ─── 10. CARDS ──────────────────────────────────────────────────────────
function SectionCards() {
  return (
    <Section
      id="cards" eyebrow="Components · 04"
      title="Cards"
      lede="Most surfaces are cards. Generous radii (18–22), one-pixel resting shadow, ample internal padding. Cards never carry borders in light mode — they earn separation through surface tone and shadow.">
      <Sub title="Balance card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <BalanceCard sign="+" amount={143} cents={50} label="you're owed, overall"/>
          <BalanceCard sign="−" amount={24}  cents={80} label="you owe Sam" coral/>
        </div>
      </Sub>

      <Sub title="Group card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <GroupCard emoji="🌲" name="Big Sur Trip" members={['you','sam','taylor','jordan']} net={143.50}/>
          <GroupCard emoji="🏠" name="Apartment 4B" members={['you','riley','jordan']} net={-86.00}/>
        </div>
      </Sub>

      <Sub title="Expense row">
        <Card pad={0}>
          {[
            { emoji: '🏠', desc: 'Airbnb (Fri–Sun)', who: 'Sam paid · 2 days ago', amt: 640, net: -160 },
            { emoji: '⛽', desc: 'Gas — round trip', who: 'You paid · 2 days ago',  amt: 86,  net: 64.5 },
            { emoji: '🛒', desc: "Trader Joe's run", who: 'Taylor paid · yesterday', amt: 124, net: -31 },
          ].map((e, i) => (
            <div key={e.desc} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              borderTop: i === 0 ? 'none' : `0.5px solid ${SG.line}`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: SG.bg, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>{e.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{e.desc}</div>
                <div style={{ fontSize: 11, color: SG.inkMuted, marginTop: 2 }}>{e.who}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: '"Bricolage Grotesque", system-ui',
                  fontSize: 18, fontWeight: 600, letterSpacing: -0.4,
                }}>${e.amt}.00</div>
                <div style={{
                  fontSize: 11, fontWeight: 700, marginTop: 2,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: e.net > 0 ? SG.mintInk : SG.coralInk,
                }}>{e.net > 0 ? '+' : '−'}${Math.abs(e.net).toFixed(0)}</div>
              </div>
            </div>
          ))}
        </Card>
      </Sub>
    </Section>
  );
}

function BalanceCard({ sign, amount, cents, label, coral }) {
  return (
    <Card pad={24}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: SG.inkMuted,
      }}>{label}</div>
      <div style={{
        marginTop: 6,
        fontFamily: '"Bricolage Grotesque", system-ui',
        fontSize: 56, fontWeight: 600, letterSpacing: -2, lineHeight: 0.95,
        color: coral ? SG.coralInk : SG.mintInk,
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        <span style={{ fontSize: 28, fontWeight: 500, opacity: 0.7 }}>{sign}$</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{amount}</span>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 14, color: SG.inkMuted, marginLeft: 4, fontWeight: 500,
        }}>.{String(cents).padStart(2, '0')}</span>
      </div>
    </Card>
  );
}

function GroupCard({ emoji, name, members, net }) {
  return (
    <Card pad={18} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: SG.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 10.5, color: SG.inkMuted, marginTop: 2 }}>{members.length} people · 5 expenses</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <AvatarStack ids={members} size={20} max={4} overlap={0.35}/>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: '"Bricolage Grotesque", system-ui',
            fontSize: 20, fontWeight: 600, letterSpacing: -0.4,
            color: net > 0 ? SG.mintInk : SG.coralInk, lineHeight: 1,
          }}>
            {net > 0 ? '+' : '−'}${Math.abs(net).toFixed(0)}
          </div>
          <div style={{ fontSize: 10, color: SG.inkMuted, marginTop: 2 }}>
            {net > 0 ? "you're owed" : 'you owe'}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── 11. INPUTS ─────────────────────────────────────────────────────────
function SectionInputs() {
  return (
    <Section
      id="inputs" eyebrow="Components · 05"
      title="Inputs"
      lede="The text input is plain and large. The amount input is the loudest text in the app — Bricolage at 42pt with a soft dollar sign and tabular cents.">
      <Sub title="Description + emoji">
        <Card>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: SG.surfaceAlt, border: `0.5px solid ${SG.line}`,
              fontSize: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🍕</div>
            <div style={{
              flex: 1, padding: '0 14px', height: 52,
              background: SG.surfaceAlt, border: `0.5px solid ${SG.line}`,
              borderRadius: 14, color: SG.ink,
              fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center',
            }}>
              Pizza dinner at Tony's<span style={{
                display: 'inline-block', width: 1.5, height: 18,
                background: SG.ink, marginLeft: 2,
                animation: 'sg-blink 1s steps(2) infinite',
              }}/>
            </div>
          </div>
        </Card>
      </Sub>

      <Sub title="Amount" hint="big bricolage, tabular">
        <Card>
          <div style={{
            background: SG.surfaceAlt, borderRadius: 14, padding: '12px 16px',
            border: `0.5px solid ${SG.line}`,
            display: 'flex', alignItems: 'baseline', gap: 4,
          }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: SG.inkMuted }}>$</span>
            <span style={{
              fontFamily: '"Bricolage Grotesque", system-ui',
              fontSize: 42, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}>86.40</span>
          </div>
        </Card>
      </Sub>
    </Section>
  );
}

// ─── 12. RECEIPT ────────────────────────────────────────────────────────
function SectionReceipt() {
  return (
    <Section
      id="receipt" eyebrow="Components · 06"
      title="Receipt block"
      lede="Used in Quick Split to make the bill feel like a bill — a tactile object you're working with, not a form. Perforated bottom edge, tabular numerals, dashed divider above the per-person breakdown.">
      <Card pad={24}>
        <div style={{
          width: 320, padding: '20px 22px 18px',
          background: SG.surface, borderRadius: 22,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 0 rgba(31,26,20,0.04), 0 0 0 0.5px rgba(31,26,20,0.06)',
          margin: '0 auto',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: SG.inkMuted }}>
            Big Sur Tavern · just now
          </div>
          <div style={{
            fontFamily: '"Bricolage Grotesque", system-ui',
            fontSize: 44, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.05,
            marginTop: 4,
            display: 'flex', alignItems: 'baseline', gap: 2,
          }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: SG.inkMuted }}>$</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>134</span>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 15, color: SG.inkMuted, marginLeft: 2,
            }}>.42</span>
          </div>
          <div style={{ fontSize: 11.5, color: SG.inkMuted, marginTop: 2 }}>
            $108.89 + $9.39 tax + $19.60 tip
          </div>
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: `1px dashed ${SG.lineStrong}`,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {[['you', 25.41], ['sam', 22.18], ['ali', 32.85], ['jordan', 28.45]].map(([id, v]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar id={id} size={22}/>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{PERSON_BY_ID[id]?.name || id}</div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700,
                }}>${v.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{
            position: 'absolute', left: -8, right: -8, bottom: -8,
            height: 16,
            backgroundImage: `radial-gradient(circle at 8px 8px, ${SG.bg} 5px, transparent 5.5px)`,
            backgroundSize: '16px 16px', pointerEvents: 'none',
          }}/>
        </div>
      </Card>
    </Section>
  );
}

// ─── 13. BOTTOM SHEET ───────────────────────────────────────────────────
function SectionSheet() {
  return (
    <Section
      id="sheet" eyebrow="Components · 07"
      title="Bottom sheet"
      lede="On mobile, decisions happen in sheets. 28px top corners, drag handle, content padded to the safe area. Sheets always sit on a dimmed-but-visible background — you should feel like you're standing in front of the previous screen.">
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 340, background: SG.bg }}>
          {/* Dimmed bg */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 30%, ${SG.sunSoft} 0, transparent 35%),
              radial-gradient(circle at 80% 35%, ${SG.mintSoft} 0, transparent 40%)`,
            opacity: 0.5,
          }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,12,8,0.18)' }}/>
          <div style={{
            position: 'absolute', left: 32, right: 32, bottom: 0,
            background: SG.surface,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '12px 24px 28px',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: SG.lineStrong, margin: '0 auto 16px',
            }}/>
            <div style={{
              fontFamily: '"Bricolage Grotesque", system-ui',
              fontSize: 22, fontWeight: 600, letterSpacing: -0.6,
            }}>What are you splitting?</div>
            <div style={{ fontSize: 13, color: SG.inkMuted, marginTop: 4 }}>Pick a mode. You can switch any time.</div>
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 14, background: SG.sunSoft,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, background: SG.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>🧾</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: SG.sunInk }}>Quick split a receipt</div>
                <div style={{ fontSize: 11, color: SG.sunInk, opacity: 0.7 }}>60-second flow · share via link</div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Section>
  );
}

// ─── 14. TAB BAR ────────────────────────────────────────────────────────
function SectionTabbar() {
  return (
    <Section
      id="tabbar" eyebrow="Components · 08"
      title="Tab bar"
      lede="Pill-shaped, floating above content with a soft fade behind it. The FAB sits outside the pill — it's not nav, it's an action.">
      <Card pad={36} style={{ background: SG.bg }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', maxWidth: 380, margin: '0 auto',
        }}>
          <div style={{
            flex: 1,
            background: SG.surface, borderRadius: 22,
            padding: '8px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}>
            {[
              ['home', true],
              ['groups', false],
              ['activity', false],
              ['me', false],
            ].map(([icon, active]) => {
              const c = active ? SG.ink : SG.inkFaint;
              const sw = 1.8;
              const ic = {
                home:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-7h-4v7H5a1 1 0 01-1-1v-9z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill={active ? c : 'none'} fillOpacity={active ? 0.12 : 0}/></svg>,
                groups:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="9" r="3" stroke={c} strokeWidth={sw}/><circle cx="16" cy="9" r="3" stroke={c} strokeWidth={sw}/><path d="M3 19c0-2.5 2.5-4 5-4s5 1.5 5 4M11 19c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke={c} strokeWidth={sw} strokeLinecap="round"/></svg>,
                activity:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2-6 4 12 2-6h6" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/></svg>,
                me:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth={sw}/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" stroke={c} strokeWidth={sw} strokeLinecap="round"/></svg>,
              };
              return <div key={icon} style={{ padding: 8 }}>{ic[icon]}</div>;
            })}
          </div>
          <button style={{
            width: 54, height: 54, borderRadius: 18,
            background: SG.sun, color: SG.sunInk,
            border: 0, cursor: 'pointer', fontSize: 28, fontWeight: 500, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Bricolage Grotesque", system-ui',
            boxShadow: `0 8px 20px rgba(242,192,74,0.5), 0 0 0 4px ${SG.bg}`,
          }}>+</button>
        </div>
      </Card>
    </Section>
  );
}

// ─── 15. MONEY ──────────────────────────────────────────────────────────
function SectionMoney() {
  return (
    <Section
      id="money" eyebrow="Money · 01"
      title="Numbers & balances"
      lede="The signature treatment: a big Bricolage number, a slightly smaller dollar sign at half-opacity, and the cents trailing in JetBrains Mono. Sign is always shown explicitly — never bare numbers — because direction-of-debt is the meaning.">
      <Sub title="Anatomy">
        <Card pad={28}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 2,
            fontFamily: '"Bricolage Grotesque", system-ui',
            color: SG.mintInk, fontWeight: 600, letterSpacing: -2.2, lineHeight: 0.95,
          }}>
            <span style={{ fontSize: 32, fontWeight: 500, opacity: 0.7 }}>+$</span>
            <span style={{ fontSize: 72, fontVariantNumeric: 'tabular-nums' }}>143</span>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 18, color: SG.inkMuted, marginLeft: 4, fontWeight: 500,
            }}>.50</span>
          </div>
          <div style={{
            display: 'flex', gap: 18, marginTop: 24, fontSize: 11.5, color: SG.inkMuted,
          }}>
            <Spec label="Sign + symbol" v="½-opacity, 32px"/>
            <Spec label="Amount" v="Bricolage 72px"/>
            <Spec label="Cents" v="Mono 18px, muted"/>
          </div>
        </Card>
      </Sub>

      <Sub title="Direction of debt">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Card>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SG.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>You're owed</div>
            <div style={{
              marginTop: 8, fontFamily: '"Bricolage Grotesque", system-ui',
              fontSize: 38, fontWeight: 600, letterSpacing: -1.2, color: SG.mintInk,
            }}>+$143.50</div>
            <Mono>mint · mintInk</Mono>
          </Card>
          <Card>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SG.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>You owe</div>
            <div style={{
              marginTop: 8, fontFamily: '"Bricolage Grotesque", system-ui',
              fontSize: 38, fontWeight: 600, letterSpacing: -1.2, color: SG.coralInk,
            }}>−$24.80</div>
            <Mono>coral · coralInk</Mono>
          </Card>
          <Card>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SG.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Square</div>
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: SG.inkMuted, padding: '5px 12px',
                background: SG.bg, borderRadius: 999,
              }}>square ✓</span>
            </div>
            <div style={{ marginTop: 22 }}><Mono>neutral · subtle</Mono></div>
          </Card>
        </div>
      </Sub>

      <Sub title="Format rules">
        <Card>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
            {[
              ['Always show the sign', 'Even when context implies direction. \u201C+$24.50\u201D not \u201C$24.50\u201D.'],
              ['Use the minus glyph', 'U+2212 (\u201C\u2212\u201D), not a hyphen. It aligns with the $ baseline.'],
              ['Cents in mono', 'Tabular alignment matters more than visual consistency for amounts under $1,000.'],
              ['Drop cents in summaries', "List rows and tiles show whole dollars; the hero shows the full thing."],
              ['Comma at thousands', 'Standard US grouping. No currency code unless we add multi-currency.'],
            ].map(([h, b]) => (
              <li key={h} style={{ display: 'flex', gap: 12 }}>
                <span style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                  background: SG.mint, color: SG.mintInk,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                }}>✓</span>
                <div>
                  <span style={{ fontWeight: 700 }}>{h}.</span>{' '}
                  <span style={{ color: SG.inkMuted }}>{b}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </Sub>
    </Section>
  );
}

function Spec({ label, v }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: SG.inkFaint, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 3 }}><Mono>{v}</Mono></div>
    </div>
  );
}

// ─── 16. DUAL MODE ──────────────────────────────────────────────────────
function SectionDualMode() {
  return (
    <Section
      id="dual-mode" eyebrow="Patterns · 01"
      title="Dual-mode entry"
      lede="Two different mental models live in Tally — async groups and synchronous quick splits. The FAB on Home is the single entry point that branches into both.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ModeCol
          accent={SG.mint} accentSoft={SG.mintSoft} accentInk={SG.mintInk}
          emoji="🌲" name="Groups"
          tagline="Async · accumulative · settle eventually"
          rows={[
            ['Time horizon', 'Weeks → months'],
            ['Intent',       'Track shared spending'],
            ['Participants', 'Members with accounts'],
            ['Resolution',   'Periodic settle-up'],
          ]}
        />
        <ModeCol
          accent={SG.sun} accentSoft={SG.sunSoft} accentInk={SG.sunInk}
          emoji="🧾" name="Quick Split"
          tagline="Sync · immediate · resolve right now"
          rows={[
            ['Time horizon', 'Right now (5 min)'],
            ['Intent',       'Sort this one bill, fast'],
            ['Participants', 'Names only — no account'],
            ['Resolution',   'Share link → Venmo / Zelle'],
          ]}
        />
      </div>

      <Sub title="Bridge">
        <Card style={{ background: SG.lavender + '22', border: `1px solid ${SG.lavender}66`, boxShadow: 'none' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: SG.lavender, color: SG.ink,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0, fontWeight: 700,
            }}>↔</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              A completed Quick Split offers <b>"save to group"</b> — promoting ephemeral participants into a real group. The lavender tone signals "this connects the two worlds" wherever it appears.
            </div>
          </div>
        </Card>
      </Sub>
    </Section>
  );
}

function ModeCol({ accent, accentSoft, accentInk, emoji, name, tagline, rows }) {
  return (
    <Card style={{ borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: accentSoft, color: accentInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>{emoji}</div>
        <div>
          <div style={{
            fontFamily: '"Bricolage Grotesque", system-ui',
            fontSize: 22, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1,
          }}>{name}</div>
          <div style={{ fontSize: 11.5, color: SG.inkMuted, marginTop: 3 }}>{tagline}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 7, columnGap: 12, fontSize: 12.5 }}>
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <Mono>{k.toUpperCase()}</Mono>
            <div style={{ color: SG.ink, lineHeight: 1.4 }}>{v}</div>
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

// ─── 17. AUTO-CATEGORIZE ────────────────────────────────────────────────
function SectionAutoCat() {
  const [demo, setDemo] = React.useState('pizza for the crew');
  const cat = categorize(demo) || CATEGORY_BY_ID.misc;
  const presets = ['pizza for the crew', 'Uber home from dinner', "Trader Joe's run", 'cleaner', 'beers at the brewery'];
  return (
    <Section
      id="auto-cat" eyebrow="Patterns · 02"
      title="Auto-categorize"
      lede="When you type a description, Tally picks an emoji and category. You can override with one tap on the pill row, and a 'reset to auto' link lets you snap back. Live demo below — try a preset.">
      <Card>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: SG.bg, border: `0.5px solid ${SG.line}`,
            fontSize: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span key={cat.id} style={{ animation: 'tally-pop 0.25s ease', display: 'inline-block' }}>{cat.emoji}</span>
          </div>
          <input value={demo} onChange={e => setDemo(e.target.value)} style={{
            flex: 1, padding: '0 14px', height: 52,
            background: SG.bg, border: `0.5px solid ${SG.line}`,
            borderRadius: 14, color: SG.ink, font: 'inherit',
            fontSize: 15, fontWeight: 600, outline: 'none',
          }}/>
        </div>

        <div style={{
          padding: '10px 12px', borderRadius: 14,
          background: SG.bg, border: `0.5px solid ${SG.line}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: SG.inkMuted }}>Category</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10.5, fontWeight: 700, color: SG.sunInk,
              background: SG.sunSoft, padding: '2px 8px', borderRadius: 999, letterSpacing: 0.3,
            }}>
              <svg width="9" height="9" viewBox="0 0 12 12"><path d="M6 1l1.2 3.3L10.5 5.5l-3.3 1.2L6 10l-1.2-3.3L1.5 5.5l3.3-1.2L6 1z" fill="currentColor"/></svg>
              Auto
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.slice(0, 10).map(c => {
              const on = cat.id === c.id;
              return (
                <div key={c.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 11px 5px 8px', borderRadius: 999,
                  background: on ? SG.ink : SG.surface,
                  color: on ? SG.bg : SG.ink,
                  fontSize: 12, fontWeight: 600,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{c.emoji}</span>
                  {c.label}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 11, color: SG.inkMuted, fontWeight: 700, marginRight: 4 }}>Try:</div>
          {presets.map(p => (
            <button key={p} onClick={() => setDemo(p)} style={{
              padding: '4px 10px', borderRadius: 999,
              background: SG.surface, color: SG.ink,
              border: `0.5px solid ${SG.line}`,
              cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 600,
            }}>"{p}"</button>
          ))}
        </div>
      </Card>

      <Sub title="Taxonomy" hint={`${CATEGORIES.length} categories`}>
        <Card pad={0}>
          {CATEGORIES.map((c, i) => (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 1fr 80px',
              alignItems: 'center', gap: 14,
              padding: '10px 18px',
              borderTop: i === 0 ? 'none' : `0.5px solid ${SG.line}`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: SG.bg, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{c.emoji}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: SG.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.keywords.slice(0, 5).join(', ') || '—'}
              </div>
              <Mono>{c.id}</Mono>
            </div>
          ))}
        </Card>
      </Sub>
    </Section>
  );
}

// ─── 18. PRINCIPLES ─────────────────────────────────────────────────────
function SectionPrinciples() {
  const principles = [
    {
      h: 'The amount is always the hero',
      b: "On every screen, the largest piece of typography is a number. People come here to know how much, not to admire the layout."
    },
    {
      h: "Two modes, one app",
      b: "Groups and Quick Split share components and palette, but their navigation and time horizon are distinct. Don't let either eat the other."
    },
    {
      h: 'Warm cream, never pure white',
      b: 'The base background is #F4EEE3. Pure white feels like a tax document. Tally is a friend offering to do the math.'
    },
    {
      h: 'Mint and coral, never red and green',
      b: 'Color-coding direction-of-debt should not feel like a warning or a celebration. Just a calm "this way" / "that way".'
    },
    {
      h: 'Pills do the verbs',
      b: 'Category, person, status, filter — wherever the user is choosing among a small set, a row of pills is the answer.'
    },
    {
      h: 'Numbers in mono align; numbers in Bricolage punch',
      b: "When numbers are in a column or a small caption, JetBrains Mono. When they're the answer to a question, Bricolage."
    },
  ];
  return (
    <Section
      id="principles" eyebrow="Patterns · 03"
      title="Principles"
      lede="The shorthand we use when deciding whether something feels like Tally.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {principles.map((p, i) => (
          <Card key={p.h} pad={22}>
            <div style={{
              fontFamily: '"Bricolage Grotesque", system-ui',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
              color: SG.inkFaint,
              fontFamilyMono: '"JetBrains Mono", monospace',
            }}><Mono>0{i + 1}</Mono></div>
            <div style={{
              fontFamily: '"Bricolage Grotesque", system-ui',
              fontSize: 22, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.15,
              marginTop: 6, color: SG.ink,
            }}>{p.h}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: SG.inkMuted, lineHeight: 1.55 }}>{p.b}</div>
          </Card>
        ))}
      </div>

      <Sub title="Working with this system">
        <Card>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: SG.ink }}>
            Tokens and components live in <Token>tally-shared.jsx</Token>. The two main entry points are{' '}
            <a href="Tally.html" style={{ color: SG.ink, fontWeight: 700 }}>Tally.html</a> (every screen on a canvas) and this style guide. To extend the system, add tokens to <Token>TallyTokens</Token>, components to a new <Token>variation-*.jsx</Token>, and document them here.
          </div>
        </Card>
      </Sub>
    </Section>
  );
}

window.StyleGuide = StyleGuide;
