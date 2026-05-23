# Tally — Claude Code Context

Tally is a free expense-splitting app. Groups of people log shared costs, the app tracks who paid what, and calculates the minimum transfers to zero everyone out. Like Splitwise, but free and with no paywalled features.

---

## Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | File-based routing, middleware auth, API routes |
| UI state | Zustand | Active group, open modals — client components only |
| Server state | TanStack Query | All Supabase fetching + mutations — client components only |
| Backend | Supabase | Postgres + Auth (no Realtime — see sync strategy below) |
| Hosting | Vercel (frontend) + Supabase Cloud | Next.js deploys natively to Vercel |

**Most components are Client Components** (`'use client'`) — Tally is highly interactive with optimistic mutations. Server Components are used for the shell/layout and public pages (`/expense/:token`) only.

```ts
// Reading data
const { data: expenses, isLoading } = useQuery({
  queryKey: ['expenses', groupId],
  queryFn:  () => fetchExpenses(groupId),
})

// Writing data
const addExpense = useMutation({
  mutationFn: (expense) => saveExpense(expense),
  onMutate: async (newExpense) => {
    // Optimistic update — show immediately
    const prev = queryClient.getQueryData(['expenses', groupId])
    queryClient.setQueryData(['expenses', groupId], old => [...old, newExpense])
    return { prev }
  },
  onError: (_, __, ctx) => {
    // Roll back if save fails
    queryClient.setQueryData(['expenses', groupId], ctx.prev)
  },
  onSuccess: () => {
    // Sync with server — balances recompute automatically
    queryClient.invalidateQueries(['expenses',    groupId])
    queryClient.invalidateQueries(['settlements', groupId])
  },
})
```

**Sync strategy — no WebSockets, no polling, no Supabase Realtime.**
Tally is async. People don't stare at the same screen simultaneously — they log expenses and check later. TanStack defaults cover everything:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // data fresh for 1 minute
      refetchOnWindowFocus: true,  // refetch when user returns to tab/app
      refetchOnMount: true,        // refetch when navigating to a screen
    }
  }
})
```

- **Your own action** → optimistic update fires instantly, `invalidateQueries` syncs on success
- **Someone else's action** → they see it next time they navigate to the screen or return to the app
- **Pull-to-refresh** → manual `queryClient.invalidateQueries` for the "I just got a text, let me check" moment

Do NOT add `refetchInterval`. Do NOT add Supabase Realtime. Do NOT manually push items into the TanStack cache from a socket — it causes deduplication bugs. Invalidate and let TanStack refetch cleanly. Realtime belongs in Phase 3 (live collaborative receipt splitting). Not before.

---

## Navigation

Tab bar + FAB. Four persistent tabs: **Home · Groups · Activity · Me**. The FAB opens a mode sheet branching into "Add to group" or "Split a bill" (which auto-creates a group).

Everything is a group. There is no separate quick_splits table. "Split a bill" silently creates a group named "Dinner · May 21", adds an itemized expense, and lets the user invite people.

**Route structure (Next.js App Router):**

```
app/
  layout.tsx                   # Root layout — QueryClient provider, Zustand
  page.tsx                     # / — Home (balance hero + recent activity)
  login/
    page.tsx                   # /login — Sign in with Google
  groups/
    page.tsx                   # /groups — Groups list
    new/page.tsx               # /groups/new — Create group
    [id]/
      page.tsx                 # /groups/[id] — Group detail
      add/page.tsx             # /groups/[id]/add — Add expense
      settle/page.tsx          # /groups/[id]/settle — Settle up
  add/
    [add_code]/page.tsx        # /add/[add_code] — QR code destination
  invite/
    [token]/page.tsx           # /invite/[token] — join group (auth required, auto-joined after sign-in)
  expense/
    [share_token]/page.tsx     # /expense/[share_token] — public read-only split view, no auth
  activity/page.tsx            # /activity — Activity feed
  me/page.tsx                  # /me — Profile + notifications
  api/
    ocr/route.ts               # POST /api/ocr — proxies to homelab Ollama (Phase 3)
```

**Auth middleware** — protects all routes except `/login` and `/invite/[token]`:

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createServerClient(...)
  const { data: { session } } = await supabase.auth.getSession()

  const isPublic = ['/login', '/invite', '/expense'].some(p =>
    request.nextUrl.pathname.startsWith(p)
  )

  if (!session && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return response
}
```

After Google OAuth, read `?redirect` param and navigate there — preserves deep links like `/add/A8F3BC2D` through the sign-in flow.

---

## MVP scope

Build Phase 1 only. The minimum loop:

1. Auth — sign up, sign in
2. Groups — create, list, detail
3. Members — add existing Tally users (no guests until Phase 2)
4. Add expense — **equal split only**
5. Balance calculation + debt simplification
6. Settle up + settlement confirmation

Everything else is Phase 2+. Do not build itemized splits, guest profiles, activity feed tab, category picker, quick split flow, or notifications until Phase 1 ships and real users are using it.

---

## Data model

```sql
-- Extends Supabase auth.users
-- user_id is NULL for guest profiles (Phase 2)
profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users UNIQUE,  -- NULL for guests
  name         text NOT NULL,       -- from Google, auto-set, never changes
  display_name text,                -- user-set in profile settings, shown everywhere in UI
                                    -- UI always renders: display_name ?? name
  email        text,                -- from Google, unique, used for search only — never shown to other users
  avatar_url   text,                -- from Google profile photo
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'guest')),
  claim_token  text UNIQUE,         -- guests claim via /claim/:token
  created_at   timestamptz DEFAULT now()
)

groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  emoji        text NOT NULL DEFAULT '💸',
  created_by   uuid REFERENCES profiles NOT NULL,
  invite_token text UNIQUE DEFAULT substr(md5(random()::text), 1, 12),
                             -- /invite/:token → join group, requires sign-in
  created_at   timestamptz DEFAULT now()
)

group_members (
  group_id    uuid REFERENCES groups ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles ON DELETE CASCADE,
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
)

expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid REFERENCES groups ON DELETE CASCADE NOT NULL,
  paid_by       uuid REFERENCES profiles NOT NULL,
  description   text NOT NULL,
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  split_type    text NOT NULL CHECK (split_type IN ('equal', 'exact', 'itemized')),
  category      text,                               -- emoji e.g. '🍽️'
  tax           numeric(10,2) DEFAULT 0,            -- itemized only, distributed proportionally
  tip           numeric(10,2) DEFAULT 0,            -- itemized only, distributed proportionally
  expense_date  date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),          -- set by trigger on every UPDATE
  share_token   text UNIQUE                         -- null until user taps Share
                             -- /expense/:token → public read-only view, no auth required
)

expense_splits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id    uuid REFERENCES expenses ON DELETE CASCADE NOT NULL,
  user_id       uuid REFERENCES profiles NOT NULL,
  owed_amount   numeric(10,2) NOT NULL              -- final amount incl. proportional tax/tip
)

-- Line items for split_type = 'itemized'
expense_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   uuid REFERENCES expenses ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  price        numeric(10,2) NOT NULL CHECK (price > 0)
)

-- Many-to-many: which members share each item
-- Multiple people on one item = price / count split equally among them
expense_item_assignments (
  item_id   uuid REFERENCES expense_items ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles ON DELETE CASCADE,
  PRIMARY KEY (item_id, user_id)
)

settlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      uuid REFERENCES groups ON DELETE CASCADE NOT NULL,
  from_user     uuid REFERENCES profiles NOT NULL,  -- who paid
  to_user       uuid REFERENCES profiles NOT NULL,  -- who is owed
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  note          text,
  settled_date  date NOT NULL DEFAULT CURRENT_DATE, -- when payment happened (user-set)
  created_at    timestamptz DEFAULT now(),           -- when it was recorded (for activity feed)
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed'))
  -- denial = DELETE the row. No disputed state.
)

notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid REFERENCES profiles NOT NULL,
  type          text NOT NULL CHECK (type IN (
                  'settlement_confirm',    -- to payee: "X says they paid you $N"
                  'settlement_confirmed',  -- to payer: "Y confirmed your payment ✓"
                  'settlement_denied'      -- to payer: "Y hasn't confirmed yet"
                )),
  settlement_id uuid REFERENCES settlements ON DELETE CASCADE,
  read          boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
)
```

**updated_at trigger** — add to expenses so edits surface in the activity feed:

```sql
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

---

## Architecture rules

**Receipt scanning — input method within add expense, not a separate flow (Phase 3).**
Groups is the primary focus. Receipt scanning is just an optional way to pre-fill an itemized expense — it lives inside the add expense form, not as a separate entry point.

```
FAB → pick existing group or create new → add expense form
                                            ├── Manual entry (equal or exact split)
                                            └── Scan receipt → pre-fills items from OCR
                                                  → items + prices populated automatically
                                                  → select which group members are included
                                                  → assign items to named people
                                                  → tax/tip distributed proportionally
                                                  → save
```

The group is always established before scanning. Members are already known from the group. Scanning just saves typing. Do not build a scan-first wizard that picks a group at the end — group comes first, scan is just data entry.

Two scenarios receipt scanning covers:
1. **Quick group from a bill** — create a new group (auto-named), scan the receipt, assign, done
2. **Add to existing group** — open the group, add expense, scan the receipt, assign, done

Same add expense form, same flow. The scan button is just a shortcut to pre-fill the items section.

**Two share mechanisms — different purposes, different auth requirements.**

| Link | Route | Auth | Purpose |
|---|---|---|---|
| `groups.invite_token` | `/invite/:token` | Required — sign in to join | Add someone to a group permanently |
| `expenses.share_token` | `/expense/:token` | None — fully public | View a split breakdown without an account |

`invite_token` — auto-generated on group creation. Tapping the link without a session redirects to `/login?redirect=/invite/:token`, signs in with Google, and auto-joins the group. Use this when you've created a group and want to pull in people who weren't there for the initial setup.

`share_token` — `NULL` by default, generated only when the organiser explicitly taps "Share" on an expense. A public Next.js Server Component page fetches the expense using the Supabase service role key (bypasses RLS — access is controlled by the token itself). Shows: expense description, each person's items and total, who paid. Optionally a "Track your expenses with Tally" CTA. Use this for the restaurant moment — assign items, tap Share, drop the link in the group chat. Nobody needs an account to see what they owe.

**User discovery — three identifiers, one search.**
Users are found by name, display_name, or add_code. Name and display_name are fuzzy; add_code is exact:

```sql
SELECT id, name, display_name, avatar_url, add_code
FROM profiles
WHERE (
  name         ILIKE '%' || :query || '%'
  OR display_name ILIKE '%' || :query || '%'
  OR add_code  = upper(:query)          -- exact, case-insensitive
)
AND status = 'active'
AND id != :current_user_id
LIMIT 10
```

Never return `email` to the client — it's a search key only, never displayed.

**Recents — derived from shared groups, no extra table.**
People you've most recently shared expenses with, surfaced at the top of the add member flow:

```sql
SELECT DISTINCT p.id, p.name, p.display_name, p.avatar_url,
  MAX(e.created_at) as last_shared
FROM profiles p
JOIN group_members gm ON gm.user_id = p.id AND gm.group_id IN (
  SELECT group_id FROM group_members WHERE user_id = :me
)
LEFT JOIN expenses e ON e.group_id = gm.group_id
WHERE p.id != :me AND p.status = 'active'
GROUP BY p.id, p.name, p.display_name, p.avatar_url
ORDER BY last_shared DESC NULLS LAST
LIMIT 8
```

**QR code flow.**
Each user has an `add_code` (8-char unique slug, displayed on their profile). QR encodes `tally.app/add/:add_code`. Scanning from camera → navigates to `app/add/[add_code]/page.tsx`. Scanning in-app → `router.push('/add/' + code)`. The route fetches the profile by add_code, shows "Add [Name] to a group." Auth middleware redirects unauthenticated scanners to `/login?redirect=/add/:add_code` and restores the route post-sign-in.

**Auth — Google OAuth only.**
Sign in with Google → Supabase creates `auth.users` row → trigger auto-creates `profiles` row with name, email, avatar_url from Google metadata. No onboarding screen, no handle selection, no extra steps. Users land directly in the app.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Identity model.**
Three identifiers, three jobs:
- `id` (UUID) — internal only, used for all foreign keys, never shown to users
- `email` — unique, from Google, used for member search only, never displayed to other users
- `display_name` — not unique, user-set in profile settings, shown everywhere in the UI. Falls back to `name` (Google name) if null. Two users can share a display name — that's fine. Profile photo distinguishes them.

Always render names as: `profile.display_name ?? profile.name`

**Member search query.**
Search hits name, display_name, and email so users can be found any way:
```sql
SELECT id, name, display_name, avatar_url
FROM profiles
WHERE (
  name         ILIKE '%' || :query || '%' OR
  display_name ILIKE '%' || :query || '%' OR
  email        ILIKE '%' || :query || '%'
)
AND status = 'active'
AND id != :current_user_id
LIMIT 10
```
Return name and display_name only — never return email to the client (it's the search key, not a display field).

**Balances are computed, never stored.**
Always calculate from `expense_splits` and `settlements`. Never cache a balance in the DB.

```ts
function calcNetBalances(groupId, expenses, settlements, memberIds) {
  const net = Object.fromEntries(memberIds.map(id => [id, 0]));
  expenses.filter(e => e.group_id === groupId).forEach(e => {
    e.splits.forEach(s => {
      if (s.user_id === e.paid_by) return;
      net[e.paid_by] += s.owed_amount;
      net[s.user_id] -= s.owed_amount;
    });
  });
  settlements.filter(s => s.group_id === groupId).forEach(s => {
    net[s.from_user] += s.amount;
    net[s.to_user]   -= s.amount;
  });
  return net;
}
```

**Debt simplification — greedy min-transfer.**

```ts
function simplifyDebts(net: Record<string, number>) {
  const debtors   = Object.entries(net).filter(([,v]) => v < -0.01).map(([uid,v]) => ({ uid, amt: -v })).sort((a,b) => b.amt-a.amt);
  const creditors = Object.entries(net).filter(([,v]) => v >  0.01).map(([uid,v]) => ({ uid, amt:  v })).sort((a,b) => b.amt-a.amt);
  const out: {from:string,to:string,amount:number}[] = [];
  let d=0, c=0;
  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].amt, creditors[c].amt);
    out.push({ from: debtors[d].uid, to: creditors[c].uid, amount: Math.round(pay*100)/100 });
    debtors[d].amt -= pay; creditors[c].amt -= pay;
    if (debtors[d].amt < 0.01) d++;
    if (creditors[c].amt < 0.01) c++;
  }
  return out;
}
```

**Activity feed — derived from existing tables, no separate events table.**
The activity feed is a merged + sorted query over `expenses` and `settlements`. No extra writes needed — `created_at` on each table is the event log. For edited expenses, include rows where `updated_at` is recent even if `created_at` is old.

```ts
// Group detail page — two parallel queries, balances computed from the result
const { data: expenses }    = useQuery(['expenses',    groupId], ...)
const { data: settlements } = useQuery(['settlements', groupId], ...)

// Activity feed — same tables, merged in JS
const feed = [...expenses, ...settlements]
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

// Confirmations — separate query, pinned at top of activity
const { data: confirmations } = useQuery(['confirmations', userId],
  () => supabase.from('notifications')
    .select('*, settlements(*)')
    .eq('recipient_id', userId)
    .eq('type', 'settlement_confirm')
    .eq('read', false)
)
```

**Partial settlements just work.**
Settlements are not tied to specific expenses. Recording a $10 settlement against a $15 balance leaves a $5 balance. Multiple settlements stack. No special handling needed.

**Settlement confirmation flow.**
Settlement created with `status: 'pending'` — counts toward balance immediately (optimistic). Payee gets a `settlement_confirm` notification, pinned at top of their activity feed.
- **Confirm** → `status = 'confirmed'`, write `settlement_confirmed` back to payer
- **Deny** → DELETE the row, balance reverts, write `settlement_denied` back to payer

Guest profiles have no confirmation flow — organiser marks them as paid directly. No pending state for guests.

**Itemized split calculation.**
Each person's `owed_amount` = their item subtotal (price / assignees per item) + proportional share of tax/tip.
```
subtotal   = sum(item.price / count(assignments) for each assigned item)
tax_share  = (subtotal / group_subtotal) × tax
tip_share  = (subtotal / group_subtotal) × tip
owed       = subtotal + tax_share + tip_share
```
Always recompute `expense_splits` from `expense_item_assignments` on save. Never cache.

**RLS from day one.**
```sql
CREATE POLICY "group members only" ON expenses
  USING (group_id IN (
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  ));
```
Apply same pattern to `expense_splits`, `settlements`, `expense_items`, `expense_item_assignments`.

**Guest participants (Phase 2).**
Not in MVP. When added: `profiles` row with `user_id = NULL` and `status = 'guest'`. All expense/settlement records reference `profiles.id` and work identically. Claiming = one UPDATE setting `user_id` and `status = 'active'`. Three claim paths: auto via email match, manual link by group member, or shared claim token URL.

---

## Design system

```ts
const T = {
  bg:          '#F4EEE3',  // warm cream — page background
  surface:     '#FEFCF8',  // warm white — cards
  surfaceAlt:  '#F1EDE4',  // sub-card wells, input fields
  surfaceHov:  '#F5F1E9',  // card hover state
  ink:         '#1F1A14',
  inkMuted:    'rgba(31,26,20,0.52)',
  inkFaint:    'rgba(31,26,20,0.28)',
  line:        'rgba(31,26,20,0.07)',
  lineStrong:  'rgba(31,26,20,0.16)',

  sun:     '#F2C144', sunSoft:   '#FDF4D0', sunInk:   '#7A5200',
  mint:    '#2DB97A', mintSoft:  '#D3F5E5', mintInk:  '#0A5C35',
  coral:   '#EF6144', coralSoft: '#FCEAE7', coralInk: '#862412',
  lav:     '#9179EF', lavSoft:   '#EDE9FD', lavInk:   '#3C2BA8',

  r: { sm:8, md:12, lg:18, pill:99 },
  shadow:      '0 2px 14px rgba(31,26,20,0.09), 0 0.5px 0 rgba(31,26,20,0.06)',
  shadowSm:    '0 1px 0 rgba(31,26,20,0.04)',
  shadowFloat: '0 8px 24px rgba(0,0,0,0.08)',
};
```

**Fonts**
- `"Bricolage Grotesque"` — display: app name, headings, monetary amounts. Weight 600–800.
- `"Plus Jakarta Sans"` — UI: labels, body, buttons, inputs. Weight 400–700.
- `"JetBrains Mono"` — tabular: cents on amounts, metadata captions. Weight 400–600.

**Amount anatomy**: sign + $ in Bricolage at ½ opacity → whole number in Bricolage → .cents in JetBrains Mono muted. Always show sign. Use − (U+2212), not hyphen.

**Avatar colours** (deterministic by slot):
- Slot 1 / You: Sun bg, sunInk text
- Slot 2: Mint bg, white text
- Slot 3: Coral bg, white text
- Slot 4: Lavender bg, white text

**Lavender** = bridge colour. Appears wherever Quick Split connects to Groups ("save to group" CTA).

---

## Expense categories

7 categories. Keyword-matched on description, no API call. Tappable to override.

```ts
const CATEGORIES = [
  { emoji: '🍽️', label: 'Food & drink',  keywords: ['uber eat','doordash','grubhub','restaurant','dinner','lunch','breakfast','coffee','pizza','sushi','taco','burger','bar','cafe','ramen','brunch'] },
  { emoji: '🚗', label: 'Transport',      keywords: ['uber','lyft','taxi','gas','fuel','parking','transit','train','bus','metro','muni','bart','toll'] },
  { emoji: '🛒', label: 'Groceries',      keywords: ['grocery','groceries','costco','trader joe','whole foods','walmart','safeway','kroger','aldi','supermarket'] },
  { emoji: '✈️', label: 'Travel',         keywords: ['flight','hotel','airbnb','vrbo','hostel','motel','airline','resort'] },
  { emoji: '🏠', label: 'Home',           keywords: ['rent','utilities','electricity','internet','wifi','cable','cleaning','repairs','plumber','maintenance'] },
  { emoji: '🎉', label: 'Entertainment',  keywords: ['movie','cinema','concert','ticket','netflix','spotify','hulu','game','bowling','golf','museum','show'] },
  { emoji: '💸', label: 'Other',          keywords: [] },
] as const;
```

---

## Key screens — MVP only

| Screen | Route |
|---|---|
| Home | `/` |
| Groups list | `/groups` |
| Group detail | `/groups/:id` |
| Add expense | `/groups/:id/add` |
| Settle up | `/groups/:id/settle` |
| Create group | `/groups/new` |
| Activity | `/activity` |
| Me / notifications | `/me` |

Post-MVP screens: itemized expense `/groups/:id/add/itemized`, split a bill `/split/new`.

---

## Project structure

```
app/                   # Next.js App Router
  layout.tsx           # Root layout — providers
  page.tsx             # Home
  login/page.tsx
  groups/
    page.tsx
    new/page.tsx
    [id]/page.tsx
    [id]/add/page.tsx
    [id]/settle/page.tsx
  add/[add_code]/page.tsx
  invite/[token]/page.tsx
  activity/page.tsx
  me/page.tsx
  api/ocr/route.ts     # Ollama proxy (Phase 3)

components/            # Shared UI — Avatar, BalanceBadge, Card, Row, Btn, etc.
queries/               # TanStack Query hooks — useExpenses, useSettlements, etc.
lib/
  supabase.ts          # Supabase client (browser + server variants)
  balance.ts           # calcNetBalances + simplifyDebts
  categories.ts        # CATEGORIES + detectCategory
  splits.ts            # makeSplits
store/
  ui.ts                # Zustand — active group, open modals
types/
  index.ts
design/
  tokens.ts            # T object — single source of truth
middleware.ts          # Auth guard
```

---

## Dev commands

```bash
npm run dev          # localhost:3000 (Next.js dev server)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npx supabase start   # local Supabase (Docker required)
npx supabase db push
npx supabase gen types typescript --local > types/supabase.ts
```

---

## Conventions

- Balance math: `Math.round(x * 100) / 100` everywhere. Never let floats hit the UI.
- Split amounts must sum exactly to expense total. Assign rounding remainder to first person.
- Expenses: soft delete (`deleted_at timestamptz`). Everything else: hard delete.
- Monetary amounts: `numeric(10,2)` always, never `float`.
- Current user: always `supabase.auth.getUser()`. Never hardcode a user ID.
- `updated_at` ≠ `created_at` means an expense was edited. Show "(edited)" in activity feed.
- `settled_date` = when payment happened (user-set). `created_at` = when recorded (sort activity by this).
