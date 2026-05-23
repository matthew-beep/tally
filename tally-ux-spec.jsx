import { useState, useEffect } from "react";

function useStyles() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(link);
    const s = document.createElement('style');
    s.textContent = `*, *::before, *::after { box-sizing: border-box; margin:0; } body { background:#F4EEE3 !important; }
      ::selection { background:#F2C04A; color:#3D2E07; }
      @keyframes fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes tally-pop { from { transform:scale(0.85); opacity:0; } to { transform:scale(1); opacity:1; } }`;
    document.head.appendChild(s);
  }, []);
}

// ── Design tokens — single source of truth ────────────────────────────────────
// Named to match TallyTokens in tally-shared.jsx
const T = {
  bg:          '#F4EEE3',   // warm cream — page background, never pure white
  surface:     '#FEFCF8',   // card background — clean warm white
  surfaceAlt:  '#F1EDE4',   // sub-card wells, footer rows, input fields
  surfaceHov:  '#F5F1E9',   // card hover state
  ink:         '#1F1A14',   // near-black — primary text
  inkMuted:    'rgba(31,26,20,0.52)',
  inkFaint:    'rgba(31,26,20,0.28)',
  line:        'rgba(31,26,20,0.07)',
  lineStrong:  'rgba(31,26,20,0.16)',

  // Semantic ramp — xSoft = light fill, x = action/icon color, xInk = text on xSoft
  sun:     '#F2C144', sunSoft:   '#FDF4D0', sunInk:   '#7A5200',  // brand, FAB, "You" avatar
  mint:    '#2DB97A', mintSoft:  '#D3F5E5', mintInk:  '#0A5C35',  // positive balance
  coral:   '#EF6144', coralSoft: '#FCEAE7', coralInk: '#862412',  // negative balance / error
  lav:     '#9179EF', lavSoft:   '#EDE9FD', lavInk:   '#3C2BA8',  // bridge between modes + 4th avatar

  r: { sm:8, md:12, lg:18, xl:22, pill:99 },
  shadow:   '0 2px 14px rgba(31,26,20,0.09), 0 0.5px 0 rgba(31,26,20,0.06)',
  shadowSm: '0 1px 0 rgba(31,26,20,0.04)',
  shadowFloat: '0 8px 24px rgba(0,0,0,0.08)',
};

const F    = '"Plus Jakarta Sans", system-ui, sans-serif';
const FH   = '"Bricolage Grotesque", system-ui, sans-serif';
const FMONO= '"JetBrains Mono", monospace';

const UDATA = {
  u1: { label:'You',    i:'YO', bg:T.sun,  fg:T.sunInk },
  u2: { label:'Sam',   i:'SA', bg:T.mint,  fg:'#fff' },
  u3: { label:'Jordan',i:'JO', bg:T.coral, fg:'#fff' },
  u4: { label:'Taylor',i:'TA', bg:T.lav,   fg:'#fff' },
};

function Av({ uid, size=32 }) {
  const u = UDATA[uid]; if (!u) return null;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:u.bg, color:u.fg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:Math.round(size*0.33), fontWeight:700, fontFamily:FH, flexShrink:0, userSelect:'none' }}>
      {u.i}
    </div>
  );
}

function Bal({ amount }) {
  if (Math.abs(amount||0)<0.01) return <span style={{ fontSize:12, fontWeight:600, padding:'3px 9px', borderRadius:T.r.pill, background:T.line, color:T.inkMuted }}>settled</span>;
  const pos = (amount||0)>0;
  return <span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:T.r.pill, background:pos?T.mintSoft:T.coralSoft, color:pos?T.mintInk:T.coralInk }}>{pos?`+$${Math.abs(amount).toFixed(2)}`:`−$${Math.abs(amount).toFixed(2)}`}</span>;
}

function SecHead({ label, sub }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:24, fontWeight:700, fontFamily:FH, letterSpacing:-0.5 }}>{label}</div>
      {sub && <div style={{ fontSize:14, color:T.inkMuted, marginTop:4, lineHeight:1.5 }}>{sub}</div>}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background:T.surface, borderRadius:T.r.lg, boxShadow:T.shadowSm, ...style }}>{children}</div>;
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  const principles = [
    { e:'⚡', t:'Speed first',       d:'Add expense in under 15 seconds from the home screen. Every extra tap is a tax on trust.' },
    { e:'🧮', t:'Math disappears',   d:'Users see plain English — "you owe Sam $60" — never raw arithmetic or bilateral debt lists.' },
    { e:'😌', t:'Minimum transfers', d:'Debt simplification collapses 10 IOUs to 2–3 payments. Always show the simplified view by default.' },
    { e:'🆓', t:'Fully free',        d:'Every feature unlocked. No paywalls, no upsell banners. The entire value prop is being Splitwise without the friction.' },
  ];

  const palette = [
    { key:'bg',         hex:'#F4EEE3', note:'Page background — warm cream, never pure white' },
    { key:'surface',    hex:'#FEFCF8', note:'Card background' },
    { key:'surfaceAlt', hex:'#F1EDE4', note:'Sub-card wells, input fields, footer rows' },
    { key:'ink',        hex:'#1F1A14', note:'Primary text — warm near-black' },
    null,
    { key:'sun',        hex:'#F2C144', note:'Brand accent · FAB · "You" avatar · primary CTA' },
    { key:'sunSoft',    hex:'#FDF4D0', note:'Sun background fills' },
    { key:'mint',       hex:'#2DB97A', note:'Positive balance — you\'re owed' },
    { key:'mintSoft',   hex:'#D3F5E5', note:'Mint background fills' },
    { key:'coral',      hex:'#EF6144', note:'Negative balance — you owe · never red' },
    { key:'coralSoft',  hex:'#FCEAE7', note:'Coral background fills' },
    { key:'lav',        hex:'#9179EF', note:'Bridge between modes (save to group) · 4th avatar' },
    { key:'lavSoft',    hex:'#EDE9FD', note:'Lavender background fills' },
  ];

  return (
    <div style={{ animation:'fade-up 0.2s ease-out' }}>
      <SecHead label="Overview" sub="Problem, principles, visual language, and voice." />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:28 }}>
        <Card style={{ padding:'20px', background:T.coralSoft, boxShadow:'none', border:`0.5px solid rgba(239,97,68,0.2)` }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.coralInk, marginBottom:10 }}>Problem</div>
          <div style={{ fontSize:14, lineHeight:1.65, color:T.ink }}>Groups accumulate a tangled web of shared costs. Tracking manually is error-prone and awkward. Splitwise fixes it but gates core features — debt simplification, receipt scanning — behind a paywall.</div>
        </Card>
        <Card style={{ padding:'20px', background:T.mintSoft, boxShadow:'none', border:`0.5px solid rgba(45,185,122,0.2)` }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:T.mintInk, marginBottom:10 }}>Solution</div>
          <div style={{ fontSize:14, lineHeight:1.65, color:T.ink }}>A shared expense ledger that calculates the minimum transfers to zero everyone out, makes settling a one-tap action, and adds receipt scanning — completely free with no feature tiers.</div>
        </Card>
      </div>

      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkMuted, marginBottom:12 }}>Design principles</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:28 }}>
        {principles.map(p => (
          <Card key={p.t} style={{ padding:'18px' }}>
            <div style={{ fontSize:24, marginBottom:10 }}>{p.e}</div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:5 }}>{p.t}</div>
            <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.6 }}>{p.d}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkMuted, marginBottom:12 }}>Colour palette</div>
      <Card style={{ padding:'20px', marginBottom:28 }}>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start', marginBottom:16 }}>
          {palette.map((item, i) => item === null
            ? <div key={i} style={{ width:'0.5px', background:T.lineStrong, alignSelf:'stretch' }}/>
            : (
              <div key={i} style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'center' }}>
                <div style={{ width:40, height:40, borderRadius:10, background:item.hex, boxShadow:`0 0 0 1px ${T.lineStrong}` }}/>
                <div style={{ fontSize:11, fontWeight:700, color:T.ink, textAlign:'center' }}>{item.key}</div>
                <div style={{ fontSize:9, color:T.inkMuted, fontFamily:FMONO }}>{item.hex}</div>
              </div>
            )
          )}
        </div>
        <div style={{ fontSize:12, color:T.inkMuted, lineHeight:1.75, paddingTop:14, borderTop:`0.5px solid ${T.line}` }}>
          <b style={{ color:T.ink }}>Sun</b> — brand accent. FAB, primary CTA, logo mark, "You" avatar, Quick Split entry.<br/>
          <b style={{ color:T.ink }}>Mint</b> — positive balances, "you're owed", confirmed settlements.<br/>
          <b style={{ color:T.ink }}>Coral</b> — negative balances, "you owe", errors. Warm peach — never red; we don't scold.<br/>
          <b style={{ color:T.ink }}>Lavender</b> — the bridge. Appears wherever Quick Split connects to Groups ("save to group"). Also 4th avatar.
        </div>
      </Card>

      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkMuted, marginBottom:12 }}>Typography</div>
      <Card style={{ padding:'22px', display:'flex', flexDirection:'column', gap:16 }}>
        {[
          { sample:'+$1,247.50', font:FH, size:32, weight:600, ls:-1, name:'Bricolage Grotesque', use:'Display — app name, headings, monetary amounts, avatar initials. Weight 600–800.' },
          { sample:'Big Sur Trip · 4 people', font:F, size:18, weight:600, ls:0, name:'Plus Jakarta Sans', use:'UI — labels, body copy, buttons, input text, section heads. Weight 400–700.' },
          { sample:'$108.89 · 8.625% tax', font:FMONO, size:15, weight:500, ls:0, name:'JetBrains Mono', use:'Tabular — cents trailing amounts, metadata captions, code. Weight 400–600.' },
        ].map((t, i) => (
          <div key={t.name}>
            {i > 0 && <div style={{ height:'0.5px', background:T.line, margin:'0 0 16px' }}/>}
            <div style={{ fontSize:t.size, fontWeight:t.weight, fontFamily:t.font, letterSpacing:t.ls, marginBottom:6, lineHeight:1.1 }}>{t.sample}</div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{t.name}</div>
            <div style={{ fontSize:12, color:T.inkMuted }}>{t.use}</div>
          </div>
        ))}
        <div style={{ paddingTop:14, borderTop:`0.5px solid ${T.line}`, fontSize:12, color:T.inkMuted, lineHeight:1.6 }}>
          <b style={{ color:T.ink }}>Amount anatomy:</b> sign + $ at ~½ opacity in Bricolage → whole number in Bricolage → .cents trailing in JetBrains Mono at muted ink. Always show the sign explicitly. Use − (U+2212) not a hyphen.
        </div>
      </Card>

      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkMuted, marginBottom:12, marginTop:28 }}>Voice</div>
      <Card style={{ padding:'18px' }}>
        {[
          ['Plain about money', 'Say "you owe Sam $24", not "you have an outstanding balance".'],
          ['Never punitive',    'Owe states are coral, not red. We don\'t do scolding.'],
          ['Warm, not cute',    'No emoji stuffing in body copy. Emojis live with categories and groups only.'],
          ['Numbers first',     'The amount is always the largest thing on screen. People come here to know how much.'],
        ].map(([h, b]) => (
          <div key={h} style={{ display:'flex', gap:10, padding:'7px 0', borderBottom:`0.5px solid ${T.line}` }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:T.sun, marginTop:8, flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>{h}</div>
              <div style={{ fontSize:12, color:T.inkMuted, marginTop:2, lineHeight:1.5 }}>{b}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Flows ─────────────────────────────────────────────────────────────────────
function FlowNode({ label, type='screen' }) {
  const S = {
    screen:  { bg:T.surface,  fg:T.ink,     bd:T.lineStrong },
    trigger: { bg:T.ink,      fg:'#F4EEE3', bd:T.ink },
    action:  { bg:T.sunSoft,  fg:T.sunInk,  bd:'rgba(242,193,68,0.5)' },
    done:    { bg:T.mintSoft, fg:T.mintInk, bd:'rgba(45,185,122,0.4)' },
  };
  const s = S[type]||S.screen;
  return (
    <div style={{ padding:'9px 14px', borderRadius:T.r.md, background:s.bg, color:s.fg,
      border:`1.5px solid ${s.bd}`, fontSize:12, fontWeight:600, textAlign:'center',
      minWidth:92, lineHeight:1.3, boxShadow:T.shadowSm, flexShrink:0 }}>
      {label}
    </div>
  );
}

function Flow({ title, note, steps }) {
  return (
    <Card style={{ padding:'20px', marginBottom:10 }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom: note?4:14 }}>{title}</div>
      {note && <div style={{ fontSize:12, color:T.inkMuted, lineHeight:1.55, marginBottom:14 }}>{note}</div>}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {steps.map((s,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <FlowNode {...s}/>
            {i<steps.length-1 && <span style={{ color:T.inkFaint, fontSize:16, flexShrink:0 }}>→</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SubLabel({ children, top }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkMuted, marginBottom:10, marginTop:top||0 }}>
      {children}
    </div>
  );
}

function Flows() {
  return (
    <div style={{ animation:'fade-up 0.2s ease-out' }}>
      <SecHead label="User flows" sub="Two modes, one app. Tab bar + FAB navigation. Groups for ongoing tracking, quick split for the table right now." />

      <SubLabel>Navigation — tab bar + FAB</SubLabel>
      <Card style={{ padding:'20px', marginBottom:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:24, alignItems:'start' }}>

          {/* Tab bar mockup */}
          <div style={{ background:T.bg, borderRadius:T.r.xl, padding:'14px', border:`0.5px solid ${T.lineStrong}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:22, height:22, borderRadius:6, background:T.sun, color:T.sunInk, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, fontFamily:FH }}>T</div>
                <span style={{ fontSize:14, fontWeight:700, fontFamily:FH, letterSpacing:-0.3 }}>tally</span>
              </div>
            </div>
            <div style={{ background:T.coralSoft, borderRadius:T.r.sm, padding:'8px 10px', marginBottom:12 }}>
              <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:T.coralInk, marginBottom:2 }}>You owe overall</div>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:FH, color:T.coralInk, letterSpacing:-0.5 }}>−$88.00</div>
            </div>
            <div style={{ fontSize:10, color:T.inkMuted, marginBottom:8 }}>Recent activity…</div>
            {/* Tab bar */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:12 }}>
              <div style={{ flex:1, background:T.surface, borderRadius:14, padding:'7px 8px', display:'flex', justifyContent:'space-around', boxShadow:T.shadowFloat }}>
                {[
                  {icon:'ti-home', active:true},
                  {icon:'ti-users', active:false},
                  {icon:'ti-activity', active:false},
                  {icon:'ti-user', active:false},
                ].map((t,i) => (
                  <i key={i} className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize:16, color:t.active?T.ink:T.inkFaint }}/>
                ))}
              </div>
              <div style={{ width:36, height:36, borderRadius:11, background:T.sun, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:500, color:T.sunInk, fontFamily:FH, boxShadow:`0 6px 14px rgba(242,192,74,0.45)` }}>+</div>
            </div>
          </div>

          {/* Explanation */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.65 }}>
              The FAB is the single entry point for all creation. Tapping it opens a bottom sheet: "What are you splitting?" — two choices that branch into the two modes. The tab bar handles navigation between views.
            </div>
            {[
              { label:'Home',        bg:T.surface, color:T.ink, desc:'Balance hero + recent activity across all groups.' },
              { label:'Groups',      bg:T.surface, color:T.ink, desc:'All groups with balance badges. Create group from here.' },
              { label:'Activity',    bg:T.surface, color:T.ink, desc:'Global feed — all expenses and settlements, newest first.' },
              { label:'Me',          bg:T.surface, color:T.ink, desc:'Profile, notification inbox, settings.' },
              { label:'FAB +',       bg:T.sunSoft, color:T.sunInk, desc:'Opens mode sheet. Groups expense or Quick Split.' },
              { label:'Lav bridge',  bg:T.lavSoft, color:T.lavInk, desc:'Lavender signals "save to group" — connecting the two modes.' },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', gap:10, padding:'9px 12px', background:row.bg, borderRadius:T.r.md, border:`0.5px solid ${T.line}` }}>
                <span style={{ fontSize:12, fontWeight:700, minWidth:88, color:row.color, flexShrink:0 }}>{row.label}</span>
                <span style={{ fontSize:12, color:T.inkMuted, lineHeight:1.55 }}>{row.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <SubLabel>Groups</SubLabel>
      <Flow title="Add expense — hero flow"
        note="Most common action. Target: completable in under 15 seconds."
        steps={[
          { label:'Home', type:'screen' },
          { label:'Tap FAB', type:'trigger' },
          { label:'Mode sheet', type:'screen' },
          { label:'Group expense', type:'trigger' },
          { label:'Add expense', type:'screen' },
          { label:'Save', type:'action' },
          { label:'Updated balances', type:'done' },
        ]}/>
      <Flow title="Create a group"
        steps={[
          { label:'Groups tab', type:'screen' },
          { label:'+ New group', type:'trigger' },
          { label:'Create group', type:'screen' },
          { label:'Create', type:'action' },
          { label:'Empty group', type:'done' },
        ]}/>
      <Flow title="Settle up"
        note="Pre-fills with the largest outstanding debt involving you."
        steps={[
          { label:'Group detail', type:'screen' },
          { label:'Settle up', type:'trigger' },
          { label:'Settle up form', type:'screen' },
          { label:'Record payment', type:'action' },
          { label:'Pending confirmation', type:'done' },
        ]}/>

      <SubLabel top={20}>Quick split</SubLabel>
      <Flow title="Split a bill"
        note="No group needed. Only the organiser needs an account."
        steps={[
          { label:'Tap FAB', type:'trigger' },
          { label:'Mode sheet', type:'screen' },
          { label:'Quick split', type:'trigger' },
          { label:'Add people', type:'screen' },
          { label:'Enter items', type:'screen' },
          { label:'Assign items', type:'screen' },
          { label:'Share or save', type:'done' },
        ]}/>
      <Flow title="Save to group — the bridge"
        note="Convert a completed quick split into a group expense. Lavender tone signals this connection."
        steps={[
          { label:'Review totals', type:'screen' },
          { label:'Save to group', type:'trigger' },
          { label:'Pick group', type:'screen' },
          { label:'Confirm', type:'action' },
          { label:'Group updated', type:'done' },
        ]}/>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[{label:'Screen',type:'screen'},{label:'Tap / trigger',type:'trigger'},{label:'Async action',type:'action'},{label:'Success',type:'done'}].map(item => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <FlowNode label={item.label} type={item.type}/>
          </div>
        ))}
      </div>

      <div style={{ background:T.sunSoft, borderRadius:T.r.lg, padding:'14px 18px', border:`0.5px solid rgba(242,193,68,0.3)` }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.sunInk, marginBottom:6 }}>Quick split — key data decisions</div>
        {['Participants stored by name only — no user_id, no account required.',
          'Tax and tip distributed proportionally to each person\'s item subtotal, not equally.',
          '"Save to group" converts name-only participants to user_ids and writes to expense_splits.',
          'Lives in its own quick_splits table with no group_id foreign key.',
        ].map((s,i) => (
          <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:T.sunInk, opacity:0.9, marginBottom:3 }}>
            <span style={{ flexShrink:0, fontWeight:700 }}>·</span><span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Screens ───────────────────────────────────────────────────────────────────
function ScreenCard({ emoji, name, purpose, elements, entry, exit, phase }) {
  return (
    <Card style={{ padding:'18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ fontSize:20, width:34, height:34, borderRadius:T.r.sm, background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{emoji}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, fontFamily:FH }}>{name}</div>
          {phase && <div style={{ fontSize:10, color:T.inkMuted, marginTop:1 }}>{phase}</div>}
        </div>
      </div>
      <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.6, marginBottom:14 }}>{purpose}</div>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkFaint, marginBottom:7 }}>Key elements</div>
      <ul style={{ margin:'0 0 14px 15px', padding:0, fontSize:13, color:T.ink, lineHeight:1.85 }}>
        {elements.map((el,i) => <li key={i}>{el}</li>)}
      </ul>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {entry.map(e => <span key={e} style={{ fontSize:11, padding:'2px 8px', borderRadius:T.r.pill, background:T.bg, color:T.inkMuted, border:`0.5px solid ${T.lineStrong}` }}>← {e}</span>)}
        {exit.map(e =>  <span key={e} style={{ fontSize:11, padding:'2px 8px', borderRadius:T.r.pill, background:T.sunSoft, color:T.sunInk }}>→ {e}</span>)}
      </div>
    </Card>
  );
}

function Screens() {
  const screens = [
    { emoji:'🏠', name:'Home', phase:'Phase 1',
      purpose:'Balance hero across all groups + recent activity. FAB triggers mode sheet.',
      elements:['Net balance hero (Bricolage, coral/mint/neutral)', 'Recent activity feed: last 5 transactions', 'FAB (sun) → mode selection sheet'],
      entry:['App launch','Back from any screen'],
      exit:['Mode sheet (via FAB)','Groups tab','Activity tab','Me tab'] },
    { emoji:'👥', name:'Groups', phase:'Phase 1',
      purpose:'All groups with per-group balance. Entry to group detail and group creation.',
      elements:['Group cards: emoji, name, member count, your balance badge', '+ New group button'],
      entry:['Groups tab'],
      exit:['Group detail','Create group'] },
    { emoji:'📊', name:'Group detail', phase:'Phase 1',
      purpose:'Primary group view. Member balances, simplified debts, expense list.',
      elements:['Member balance list with badge per person', '"Who pays who" — simplified min-transfer', 'Expense list newest-first with category emoji', 'Settle up button (secondary action)'],
      entry:['Tap group card'],
      exit:['Add expense (via FAB)','Settle up','Expense detail','Back'] },
    { emoji:'➕', name:'Add expense', phase:'Phase 1',
      purpose:'The hero form. Description, amount, who paid, equal or exact split, date.',
      elements:['Category emoji tile (auto-detect, tappable to override)', 'Description field', 'Amount in Bricolage (large)', 'Paid by: member pill selector', 'Split: equal (default) or exact', 'Date picker'],
      entry:['FAB → mode sheet → group expense'],
      exit:['Group detail (on save or cancel)'] },
    { emoji:'🧾', name:'Quick split', phase:'Phase 1',
      purpose:'One-time bill splitter. No group required. Receipt block UI.',
      elements:['Add people by name (no accounts)', 'Item list: name + price, receipt block styling', 'Per-item assignment: tap → pick person', '"Everyone" bucket for shared items', 'Tax/tip: proportional to item subtotals', 'Share via link or save to group (lavender CTA)'],
      entry:['FAB → mode sheet → quick split'],
      exit:['Save to group (lavender)','Share + close'] },
    { emoji:'💸', name:'Settle up', phase:'Phase 1',
      purpose:'Record money changing hands. Creates pending settlement, notifies payee.',
      elements:['From → to avatar visual', 'Amount (pre-filled)', 'Note: "Venmo", "cash"', 'Record payment → status: pending ⏳'],
      entry:['Settle up from group detail'],
      exit:['Group detail'] },
    { emoji:'🔔', name:'Activity / Me', phase:'Phase 1 + 2',
      purpose:'Activity: global feed of all expenses/settlements. Me: profile + notification inbox for settlement confirmations.',
      elements:['Activity: newest-first across all groups', 'Me: avatar, name', 'Notifications: settlement confirm requests with ✓/✗', 'Settings (Phase 2)'],
      entry:['Activity tab','Me tab'],
      exit:['Group detail (tap expense)'] },
    { emoji:'🆕', name:'Create group', phase:'Phase 1',
      purpose:'Name + emoji. You\'re added as member 1 automatically.',
      elements:['Emoji picker (12 options)', 'Name field', 'Create (ink button)'],
      entry:['+ New group from groups tab'],
      exit:['Group detail (empty state)'] },
  ];
  return (
    <div style={{ animation:'fade-up 0.2s ease-out' }}>
      <SecHead label="Screens" sub="Tab bar + FAB gives you four persistent destinations and a single creation entry point." />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {screens.map(s => <ScreenCard key={s.name} {...s}/>)}
      </div>
    </div>
  );
}

// ── Patterns ──────────────────────────────────────────────────────────────────
function Pat({ title, children }) {
  return (
    <Card style={{ padding:'20px', marginBottom:12 }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>{title}</div>
      {children}
    </Card>
  );
}

function Patterns() {
  return (
    <div style={{ animation:'fade-up 0.2s ease-out' }}>
      <SecHead label="Interaction patterns" sub="Behaviour beyond static screens." />

      <Pat title="Money formatting rules">
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {/* Amount anatomy demo */}
          <div style={{ display:'flex', alignItems:'baseline', gap:2, padding:'12px 16px', background:T.bg, borderRadius:T.r.md }}>
            <span style={{ fontFamily:FH, fontSize:28, fontWeight:500, color:T.inkMuted, opacity:0.7 }}>+$</span>
            <span style={{ fontFamily:FH, fontSize:56, fontWeight:600, letterSpacing:-1.5, color:T.mintInk, fontVariantNumeric:'tabular-nums' }}>143</span>
            <span style={{ fontFamily:FMONO, fontSize:16, color:T.inkMuted, marginLeft:3, fontWeight:500 }}>.50</span>
          </div>
        </div>
        {[
          ['Always show the sign', '+$60.00 not $60.00. Direction-of-debt is the meaning.'],
          ['Use the minus glyph', 'U+2212 (−) not a hyphen. It aligns with the $ baseline.'],
          ['Cents in JetBrains Mono', 'Tabular alignment matters for amounts in a column.'],
          ['Drop cents in summaries', 'List rows and tiles: whole dollars. Hero and receipts: full amount.'],
          ['Comma at thousands', 'Standard US grouping. No currency code until multi-currency lands.'],
        ].map(([h,b]) => (
          <div key={h} style={{ display:'flex', gap:10, padding:'7px 0', borderBottom:`0.5px solid ${T.line}`, fontSize:13 }}>
            <span style={{ width:18, height:18, borderRadius:'50%', background:T.mint, color:T.mintInk, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0, marginTop:1 }}>✓</span>
            <div><b style={{ fontWeight:700 }}>{h}.</b> <span style={{ color:T.inkMuted }}>{b}</span></div>
          </div>
        ))}
      </Pat>

      <Pat title="Balance display logic">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { amt:60,  label:'Positive — you\'re owed money. Mint pill. "owed to you" sublabel.' },
            { amt:-28, label:'Negative — you owe money. Coral pill. "you owe" sublabel.' },
            { amt:0,   label:'Zero — all settled. Neutral grey pill. No sublabel.' },
          ].map(row => (
            <div key={row.amt} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:T.bg, borderRadius:T.r.md }}>
              <Bal amount={row.amt}/>
              <span style={{ fontSize:13, color:T.inkMuted }}>{row.label}</span>
            </div>
          ))}
          <div style={{ fontSize:12, color:T.inkMuted, marginTop:4 }}>Never display +/− as plain coloured text — always use the balance badge component.</div>
        </div>
      </Pat>

      <Pat title="Settlement confirmation">
        <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.65, marginBottom:12 }}>
          Settlements are created with <b style={{ color:T.ink }}>status: pending</b> and count toward balances optimistically (show ⏳). A <b style={{ color:T.ink }}>settlement_confirm</b> notification goes to the payee. Confirm → status: confirmed (✓). Deny → row deleted, balance reverts, <b style={{ color:T.ink }}>settlement_denied</b> notification back to payer.
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, padding:'9px 12px', background:T.mintSoft, borderRadius:T.r.md, fontSize:12, color:T.mintInk, fontWeight:600 }}>✓ Confirmed — balance stays settled</div>
          <div style={{ flex:1, padding:'9px 12px', background:T.coralSoft, borderRadius:T.r.md, fontSize:12, color:T.coralInk, fontWeight:600 }}>✗ Denied — row deleted, reverts</div>
        </div>
      </Pat>

      <Pat title="Auto-categorise + manual override">
        <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.6, marginBottom:12 }}>
          As the user types the description, keyword matching detects the category and updates the emoji tile in real time. No API call. The tile is always tappable — opens a 7-option picker grid. Once overridden manually, auto-detect stops for that expense. Clearing the description resets to auto.
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, padding:'10px', borderRadius:T.r.md, background:T.ink, color:'#F4EEE3', fontSize:13, fontWeight:700, textAlign:'center' }}>Split equally</div>
          <div style={{ flex:1, padding:'10px', borderRadius:T.r.md, background:T.surface, color:T.ink, fontSize:13, fontWeight:500, textAlign:'center', border:`1.5px solid ${T.lineStrong}` }}>Exact amounts</div>
        </div>
      </Pat>

      <Pat title="Tax and tip — quick split vs groups">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
          <div style={{ background:T.bg, borderRadius:T.r.md, padding:'10px 12px', color:T.inkMuted }}>
            <div style={{ fontWeight:700, color:T.ink, marginBottom:4 }}>Groups</div>
            Tax/tip entered as a line item or included in expense amount. Split equally by default.
          </div>
          <div style={{ background:T.sunSoft, borderRadius:T.r.md, padding:'10px 12px', color:T.sunInk }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>Quick split</div>
            Tax/tip from receipt distributed proportionally to each person's item subtotal — not equally.
          </div>
        </div>
      </Pat>

      <Pat title="Debt simplification">
        <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.65 }}>
          "Who pays who" always shows the minimum transfers to zero everyone out — never raw bilateral IOUs. Algorithm: sort by net balance, greedily match largest debtor to largest creditor. For a 5-person group this typically reduces 15 transactions to 3–4 transfers. Section hidden when everyone is settled.
        </div>
      </Pat>

      <Pat title="Empty states">
        <div style={{ fontSize:13, color:T.inkMuted, lineHeight:1.8 }}>
          <div><b style={{ color:T.ink }}>New group</b> — "No expenses yet. Add one via the + button." No illustration.</div>
          <div><b style={{ color:T.ink }}>All settled</b> — Hero shows "—" in muted ink. "All settled up." Settle up button hidden.</div>
          <div><b style={{ color:T.ink }}>No groups</b> — Single prompt card with + CTA prominent.</div>
          <div><b style={{ color:T.ink }}>Quick split, no items</b> — "Add your first item." with + icon.</div>
        </div>
      </Pat>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────
function Demo({ title, note, children }) {
  return (
    <Card style={{ padding:'18px', marginBottom:12 }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.inkMuted, marginBottom:12 }}>{title}</div>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', padding:'16px', background:T.bg, borderRadius:T.r.md, marginBottom: note?10:0 }}>
        {children}
      </div>
      {note && <div style={{ fontSize:12, color:T.inkMuted, lineHeight:1.6 }}>{note}</div>}
    </Card>
  );
}

function Components() {
  const btnBase = { padding:'10px 18px', borderRadius:T.r.md, fontSize:14, fontWeight:600, cursor:'default', fontFamily:F, border:'none' };

  return (
    <div style={{ animation:'fade-up 0.2s ease-out' }}>
      <SecHead label="Components" sub="The atoms that compose every screen." />

      <Demo title="Avatar — 4 member colours"
        note="Deterministic colour assignment: You→Sun (sunInk text), Slot 2→Mint (white text), Slot 3→Coral (white text), Slot 4→Lavender (white text). Initials in Bricolage Grotesque.">
        <div style={{ display:'flex', gap:16 }}>
          {['u1','u2','u3','u4'].map(uid => (
            <div key={uid} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <Av uid={uid} size={44}/>
              <div style={{ fontSize:11, color:T.inkMuted }}>{UDATA[uid].label}</div>
            </div>
          ))}
        </div>
        <div style={{ width:'0.5px', background:T.lineStrong, alignSelf:'stretch' }}/>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {['u1','u2','u3','u4'].map(uid => <Av key={uid} uid={uid} size={28}/>)}
          <div style={{ fontSize:11, color:T.inkMuted }}>28px</div>
        </div>
      </Demo>

      <Demo title="Balance badge — 3 states"
        note="Mint for positive (owed to you), Coral for negative (you owe), neutral for settled. Always use this component — never raw coloured text. Uses − (U+2212) glyph, not a hyphen.">
        <Bal amount={75}/> <Bal amount={-28}/> <Bal amount={0}/>
      </Demo>

      <Demo title="Buttons — 5 variants + FAB"
        note="Ink: primary confirmation (one per screen max). Sun: brand moment — FAB, Split a bill CTA. Ghost: secondary actions. Dashed: open-ended additive actions like '+ Add person'. Disabled: opacity 0.36.">
        <button style={{ ...btnBase, background:T.ink, color:'#F4EEE3' }}>Save expense</button>
        <button style={{ ...btnBase, background:T.sun, color:T.sunInk, boxShadow:`0 4px 12px rgba(242,192,74,0.35)` }}>Split a bill</button>
        <button style={{ ...btnBase, background:T.surface, color:T.ink, border:`0.5px solid ${T.lineStrong}` }}>Settle up</button>
        <button style={{ ...btnBase, background:'transparent', color:T.inkMuted }}>Cancel</button>
        <button style={{ ...btnBase, background:'transparent', color:T.inkMuted, border:`1.5px dashed ${T.lineStrong}`, borderRadius:T.r.pill, padding:'8px 14px', fontSize:13 }}>+ Add person</button>
        <div style={{ width:52, height:52, borderRadius:16, background:T.sun, color:T.sunInk, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontFamily:FH, fontWeight:500, boxShadow:`0 8px 20px rgba(242,192,74,0.5)` }}>+</div>
      </Demo>

      <Demo title="Category pills + 7-category system"
        note="Auto-detected from keyword matching on description. Tappable to override. Once overridden, auto-detect stops. Clearing description resets to auto.">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['🍽️','Food & drink',true],['🚗','Transport',false],['🛒','Groceries',false],['✈️','Travel',false],['🏠','Home',false],['🎉','Entertainment',false],['💸','Other',false]].map(([e,l,active]) => (
            <div key={l} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px 5px 7px', borderRadius:T.r.pill, background:active?T.ink:T.surface, color:active?'#F4EEE3':T.ink, fontSize:12, fontWeight:600, border:`0.5px solid ${T.lineStrong}` }}>
              <span style={{ fontSize:14 }}>{e}</span>{l}
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Money — amount anatomy"
        note="Sign + $ in Bricolage at ½ opacity → whole number in Bricolage bold → .cents in JetBrains Mono at inkMuted. Drop cents in summary rows. Always use minus glyph (U+2212), not hyphen.">
        <div style={{ display:'flex', alignItems:'baseline', gap:2 }}>
          <span style={{ fontFamily:FH, fontSize:28, fontWeight:500, color:T.mintInk, opacity:0.7 }}>+$</span>
          <span style={{ fontFamily:FH, fontSize:56, fontWeight:600, letterSpacing:-1.5, color:T.mintInk, fontVariantNumeric:'tabular-nums' }}>143</span>
          <span style={{ fontFamily:FMONO, fontSize:15, color:T.inkMuted, marginLeft:2, fontWeight:500 }}>.50</span>
        </div>
        <div style={{ width:'0.5px', background:T.lineStrong, alignSelf:'stretch' }}/>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:2 }}>
            <span style={{ fontFamily:FH, fontSize:20, fontWeight:500, color:T.coralInk, opacity:0.7 }}>−$</span>
            <span style={{ fontFamily:FH, fontSize:38, fontWeight:600, letterSpacing:-1, color:T.coralInk }}>24</span>
            <span style={{ fontFamily:FMONO, fontSize:12, color:T.inkMuted }}>.80</span>
          </div>
          <span style={{ fontSize:12, fontWeight:600, padding:'3px 9px', borderRadius:T.r.pill, background:T.line, color:T.inkMuted, alignSelf:'flex-start' }}>settled ✓</span>
        </div>
      </Demo>

      <Demo title="Card + row"
        note="Card: surface (#FEFCF8), borderRadius 18px, 1px shadowSm. Row: 12px 16px padding, 0.5px warm separator. surfaceAlt (#F1EDE4) for input fields and sub-card wells.">
        <div style={{ width:'100%', background:T.surface, borderRadius:T.r.lg, boxShadow:T.shadowSm, overflow:'hidden' }}>
          {[['🏕️ Weekend Trip','3 members',-60],['🏠 Apartment','2 members',28]].map(([name,sub,bal],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:i===0?`0.5px solid ${T.line}`:'none' }}>
              <div style={{ fontSize:18 }}>{name.split(' ')[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{name.slice(3)}</div>
                <div style={{ fontSize:12, color:T.inkMuted }}>{sub}</div>
              </div>
              <Bal amount={bal}/>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Input — description + amount"
        note="surfaceAlt (#F1EDE4) background. 1px lineStrong border, radius 14px. On focus: border → ink + 3px warm glow. Description: Plus Jakarta 15px. Amount: Bricolage 700 26–42px with soft $ prefix.">
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:T.surfaceAlt, border:`0.5px solid ${T.line}`, fontSize:24, display:'flex', alignItems:'center', justifyContent:'center' }}>🍕</div>
            <input readOnly defaultValue="Pizza dinner at Tony's" style={{ flex:1, padding:'0 14px', height:52, background:T.surfaceAlt, border:`0.5px solid ${T.line}`, borderRadius:14, color:T.ink, fontSize:15, fontWeight:600, fontFamily:F, outline:'none' }}/>
          </div>
          <input readOnly defaultValue="86.40" style={{ width:'100%', padding:'11px 14px', border:`1px solid ${T.ink}`, borderRadius:14, background:T.surfaceAlt, color:T.ink, fontSize:28, fontWeight:700, fontFamily:FH, letterSpacing:-0.5, outline:'none', boxShadow:`0 0 0 3px rgba(31,26,20,0.08)` }}/>
        </div>
      </Demo>

      <Demo title="Lavender — bridge between modes"
        note="Lavender appears wherever Quick Split connects to Groups. The 'save to group' CTA, bridge badges, and save-to-group confirmation all use lav/lavSoft/lavInk. Signals 'this crosses the two worlds'.">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <div style={{ padding:'9px 16px', borderRadius:T.r.md, background:T.lavSoft, color:T.lavInk, fontSize:13, fontWeight:600, border:`0.5px solid rgba(145,121,239,0.3)` }}>
            ↔ Save to group
          </div>
          <div style={{ fontSize:11, padding:'3px 9px', borderRadius:T.r.pill, background:`${T.lav}33`, color:T.ink, fontWeight:600 }}>saved to group</div>
          <Av uid="u4" size={32}/>
        </div>
      </Demo>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'overview',   l:'Overview' },
  { id:'flows',      l:'User flows' },
  { id:'screens',    l:'Screens' },
  { id:'patterns',   l:'Patterns' },
  { id:'components', l:'Components' },
];

export default function App() {
  useStyles();
  const [tab, setTab] = useState('overview');
  const content = { overview:<Overview/>, flows:<Flows/>, screens:<Screens/>, patterns:<Patterns/>, components:<Components/> };
  return (
    <div style={{ background:T.bg, minHeight:'100vh', fontFamily:F, color:T.ink }}>
      <div style={{ borderBottom:`0.5px solid ${T.lineStrong}`, background:T.surface, position:'sticky', top:0, zIndex:100, boxShadow:T.shadowSm }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', height:52, gap:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:T.sun, color:T.sunInk, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, fontFamily:FH }}>T</div>
            <span style={{ fontSize:17, fontWeight:700, fontFamily:FH, letterSpacing:-0.5 }}>tally</span>
            <span style={{ fontSize:12, color:T.inkMuted, marginLeft:2 }}>· UX Spec v0.2</span>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(t => {
              const on = tab===t.id;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  padding:'6px 14px', borderRadius:T.r.sm, fontSize:13, fontWeight:on?700:500,
                  cursor:'pointer', border:'none', fontFamily:F, transition:'all 0.12s',
                  background:on?T.ink:'transparent', color:on?'#F4EEE3':T.inkMuted,
                }}>{t.l}</button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ maxWidth:960, margin:'0 auto', padding:'32px 24px' }}>
        {content[tab]}
      </div>
    </div>
  );
}
