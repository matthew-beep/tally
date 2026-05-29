# Tally — Frontend Architecture

## Mental Model

Three parallel concerns that barely touch each other:

```
hooks        → what does this screen do      (data, state, mutations)
CSS          → what does this screen look like (layout, spacing, color)
Shell        → which nav do I show            (the one responsive structural decision)
```

Hooks are written once and reused anywhere — on mobile, desktop, and eventually
React Native. CSS handles responsiveness for everything except the navigation shell.
The shell is the only component that structurally differs between mobile and desktop.

---

## Part 1 — Hooks

### Why hooks

Every interactive screen does two things: manages behavior and renders markup.
Keeping them in the same file means when you need to change one, you risk breaking
the other. Hooks separate them cleanly.

The practical payoff for Tally:
- `useHome()` loads balance and activity feed — reused on the home screen and
  composable into other screens
- `useCreateGroup()` handles form state and mutation — works whether the form
  renders as a full-screen page on mobile or a modal on desktop
- `useActivity()` loads and merges the feed — reused in both the home screen
  preview and the full activity tab

**Gut-check**: delete all the JSX from a component. Is there any logic left?
If yes, move it to a hook.

### What goes where

Not every piece of logic needs to be in a hook. The rule applies to business
logic and data fetching — not all state. There's plenty that legitimately lives
in a component.

**Belongs in a hook:**
- Anything touching Supabase
- `useQuery` / `useMutation`
- Derived values from data (`isValid`, `netBalances`, `category`)
- Logic you'd want to reuse across two or more components
- Logic you'd want to test in isolation

Examples from Tally: searching for members, creating a group, loading the
activity feed, computing balances, submitting a settlement.

**Fine to keep in a component:**
- UI state that's purely presentational and local to that component
- Hover states, open/closed menus, tooltips, accordions, dropdowns
- Animation state
- `useRef` for DOM interactions

```tsx
// these never need to leave the component
const [menuOpen, setMenuOpen] = useState(false)
const [isHovered, setIsHovered] = useState(false)
const [tooltipVisible, setTooltipVisible] = useState(false)
```

Examples from Tally: whether a context menu on an expense row is open, whether
a member avatar tooltip is showing, whether a card is in a pressed state.

**The practical test**: would this logic change if you redesigned the UI?
If no — it belongs in a hook. If yes — it can stay in the component.
A balance calculation doesn't care what the UI looks like. A hover state
only exists because of a specific piece of markup.

```
hook                          component
────────────────────────────  ────────────────────────────
useQuery / useMutation        JSX tags (<div>, <input>)
Supabase calls                Event wiring (onClick, onChange)
Derived data (isValid etc)    className / style
Reusable logic                Layout structure
Navigation callbacks          Hover / open / tooltip state
                              useRef for DOM
```

### Navigation pattern

Hooks must not import `next/navigation` directly — navigation is platform-specific.
Pass it in as a callback so the hook stays portable.

```ts
// ✅ correct — hook accepts a callback
export function useAddExpense(
  groupId: string,
  { onSuccess }: { onSuccess: () => void }
) {
  const mutation = useMutation({
    mutationFn: ...,
    onSuccess,
  })
}

// component decides what "success" means
const { submit } = useAddExpense(groupId, {
  onSuccess: () => router.back()         // web
  // onSuccess: () => navigation.goBack() // React Native later
})
```

### Folder structure

```
hooks/           ← screen-level hooks (compose queries + local state)
  useAddExpense.ts
  useSettleUp.ts
  useCreateGroup.ts
  useGroupDetail.ts
  useGroupsList.ts
  useHome.ts
  useActivity.ts
  useProfile.ts
  useMemberSearch.ts
  useBreakpoint.ts   ← responsive (see Part 2)
  useAddExpenseNav.ts

queries/         ← raw TanStack Query hooks (useExpenses, useSettlements, etc.)
```

`queries/` holds the raw data fetching. `hooks/` composes those with local state
and derived values to produce everything a screen needs.

---

### Hook Specifications

---

#### `useAddExpense(groupId: string, { onSuccess }: { onSuccess: () => void })`

**State**
- `description: string`
- `amount: string`
- `paidBy: string` — defaults to current user id
- `expenseDate: string` — defaults to today (YYYY-MM-DD)

**Queries**
- `members` — group members with profile data

**Derived**
- `category` — result of `detectCategory(description)` from `lib/categories.ts`
- `isValid: boolean` — description is non-empty, amount parses to a positive number
- `parsedAmount: number` — `Math.round(parseFloat(amount) * 100) / 100`

**Mutations**
- `submit()` — saves expense, calls `onSuccess`, invalidates `['expenses', groupId]`
  and `['settlements', groupId]`

**Returns**
```ts
{
  description, setDescription,
  amount, setAmount,
  paidBy, setPaidBy,
  expenseDate, setExpenseDate,
  category,
  isValid,
  members,
  submit,
  isPending,
}
```

---

#### `useSettleUp(groupId: string, { onSuccess }: { onSuccess: () => void })`

**State**
- `amount: string` — pre-filled with outstanding balance
- `toUserId: string` — pre-filled from debt simplification
- `note: string`
- `settledDate: string` — defaults to today

**Queries**
- `members` — group members with profile data

**Derived**
- `suggestedTransfers` — `simplifyDebts(calcNetBalances(...))` filtered to current user
- `isValid: boolean` — amount is positive and toUserId is set

**Mutations**
- `submit()` — creates settlement with `status: 'pending'`, creates
  `settlement_confirm` notification for payee, calls `onSuccess`, invalidates
  `['settlements', groupId]`

**Returns**
```ts
{
  amount, setAmount,
  toUserId, setToUserId,
  note, setNote,
  settledDate, setSettledDate,
  suggestedTransfers,
  members,
  isValid,
  submit,
  isPending,
}
```

---

#### `useCreateGroup({ onSuccess }: { onSuccess: (groupId: string) => void })`

**State**
- `name: string`
- `emoji: string` — defaults to `'💸'`

**Derived**
- `isValid: boolean` — name is non-empty

**Mutations**
- `submit()` — inserts group, adds current user as member, calls `onSuccess(newGroupId)`,
  invalidates `['groups']`

**Returns**
```ts
{
  name, setName,
  emoji, setEmoji,
  isValid,
  submit,
  isPending,
}
```

---

#### `useGroupDetail(groupId: string)`

No local state. Pure composition of queries + derived values.

**Queries**
- `expenses` — all expenses for group
- `settlements` — all settlements for group
- `members` — group members with profile data
- `group` — group name and emoji

**Derived**
- `netBalances` — `calcNetBalances(groupId, expenses, settlements, memberIds)`
- `simplifiedDebts` — `simplifyDebts(netBalances)`
- `feed` — expenses + settlements merged and sorted by `created_at` descending
- `currentUserBalance` — `netBalances[currentUserId]`

**Returns**
```ts
{
  group,
  members,
  expenses,
  settlements,
  netBalances,
  simplifiedDebts,
  feed,
  currentUserBalance,
  isLoading,
}
```

---

#### `useGroupsList()`

No local state.

**Queries**
- `groups` — all groups for current user with member count

**Derived**
- Per group: `userBalance` — net balance of current user, used for balance badges

**Returns**
```ts
{
  groups,   // enriched with userBalance per group
  isLoading,
}
```

---

#### `useHome()`

No local state.

**Queries**
- `expenses` — recent expenses across all user's groups (last 10)
- `settlements` — recent settlements across all user's groups (last 10)
- `groups` — all groups for current user

**Derived**
- `totalBalance` — net balance across all groups combined
- `recentFeed` — merged + sorted, last 10 items

**Returns**
```ts
{
  totalBalance,
  recentFeed,
  groups,
  isLoading,
}
```

---

#### `useActivity()`

No local state.

**Queries**
- `expenses` — all expenses across all user's groups
- `settlements` — all settlements across all user's groups
- `pendingConfirmations` — unread `settlement_confirm` notifications for current user

**Derived**
- `feed` — merged + sorted, all items
- `confirmations` — pinned at top, unread settlement confirm requests

**Mutations**
- `confirmSettlement(settlementId)` — sets status `'confirmed'`, writes
  `settlement_confirmed` notification to payer, marks notification read,
  invalidates `['settlements']` and `['confirmations']`
- `denySettlement(settlementId)` — deletes row, writes `settlement_denied`
  notification, marks notification read, invalidates same

**Returns**
```ts
{
  feed,
  confirmations,
  confirmSettlement,
  denySettlement,
  isLoading,
}
```

---

#### `useMemberSearch(groupId: string)`

**State**
- `query: string`

**Queries**
- `results` — debounced search on name and display_name, fires when
  `query.length >= 2`. Never returns email to the client.
- `recents` — 8 most recent contacts from shared groups, shown when query is empty

**Mutations**
- `addMember(profileId)` — inserts into `group_members`, invalidates
  `['members', groupId]`

**Returns**
```ts
{
  query, setQuery,
  results,
  recents,
  addMember,
  isSearching,
}
```

---

#### `useProfile()`

**State**
- `displayName: string` — initialized from current profile

**Queries**
- `profile` — current user's profile row

**Derived**
- `isDirty: boolean` — `displayName !== profile.display_name`

**Mutations**
- `save()` — updates `profiles.display_name`, invalidates `['profile']`

**Returns**
```ts
{
  profile,
  displayName, setDisplayName,
  isDirty,
  save,
  isPending,
}
```

---

### Hooks checklist — definition of done

For each screen after implementation:

- [ ] Component file contains only JSX, style, and event wiring
- [ ] No `useState`, `useQuery`, or `useMutation` in the component file
- [ ] Hook file has no JSX imports
- [ ] Navigation is an `onSuccess` callback, not imported directly in the hook
- [ ] Derived values computed in hook, not inline in JSX
- [ ] `npm run typecheck` passes

---

## Part 2 — Responsive System

### Approach

Mobile-first. One breakpoint (768px). CSS handles layout for everything except
the navigation shell, which is the only component that structurally differs
between mobile and desktop.

**No Tailwind.** The T token system works identically in web inline styles and
React Native `StyleSheet.create()`. Tailwind has no React Native equivalent —
using it now means ripping it out later.

### The breakpoint hook

Single source of truth for layout switching. The only place `window.matchMedia`
is called. When migrating to React Native, replace this file only — nothing else
in the codebase changes.

```ts
// hooks/useBreakpoint.ts
import { useState, useEffect } from 'react'

export function useBreakpoint() {
  // undefined until client resolves — avoids Next.js hydration mismatch
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return { isMobile, isDesktop: isMobile === false }
}

// React Native replacement (swap this file only):
// import { Dimensions } from 'react-native'
// export function useBreakpoint() {
//   const width = Dimensions.get('window').width
//   return { isMobile: width < 768, isDesktop: width >= 768 }
// }
```

### The shell — the only structural split

`Shell` is the only component that renders meaningfully different markup per
breakpoint. Mobile gets a bottom tab bar. Desktop gets a sidebar. Everything
rendered inside is identical.

```tsx
// components/Shell.tsx
export function Shell({ children }: { children: React.ReactNode }) {
  const { isMobile } = useBreakpoint()

  if (isMobile === undefined) return null  // avoid hydration flash

  if (isMobile) return (
    <div style={styles.mobileRoot}>
      <main style={styles.mobileMain}>{children}</main>
      <TabBar />
    </div>
  )

  return (
    <div style={styles.desktopRoot}>
      <Sidebar />
      <main style={styles.desktopMain}>{children}</main>
    </div>
  )
}

const styles = {
  mobileRoot:  { display: 'flex', flexDirection: 'column' as const, height: '100dvh', backgroundColor: T.bg },
  mobileMain:  { flex: 1, overflowY: 'auto' as const },
  desktopRoot: { display: 'flex', flexDirection: 'row' as const, height: '100vh', backgroundColor: T.bg },
  desktopMain: { flex: 1, overflowY: 'auto' as const, maxWidth: 960, padding: 32 },
}
```

`TabBar` and `Sidebar` are not "two versions of the same component" — they are
genuinely different things that serve the same navigational purpose at different
screen sizes. Writing them as separate components is correct.

### Forms — modal vs full-screen page

The `AddExpenseForm` component is identical on both breakpoints. Only its
container differs. `useAddExpenseNav` encapsulates that decision.

```ts
// hooks/useAddExpenseNav.ts
export function useAddExpenseNav(groupId: string) {
  const { isMobile } = useBreakpoint()
  const router = useRouter()
  const openModal = useUIStore(s => s.openModal)

  return {
    open: () => isMobile
      ? router.push(`/groups/${groupId}/add`)
      : openModal('addExpense', { groupId })
  }
}
```

Apply the same pattern for settle up and create group.

### Content components — mostly CSS only

Most content components (`ExpenseRow`, `BalanceCard`, `MemberRow`) never call
`useBreakpoint`. They render the same markup at all sizes. Their container
handles layout.

Only reach for `useBreakpoint` inside a content component when:
- An element genuinely needs to show/hide (e.g. keyboard shortcut hints on desktop)
- Layout difference is too dramatic for CSS to bridge cleanly

For everything else — padding, font size, minor spacing — CSS is sufficient.

### Screen container

Wrap every page in `ScreenContainer`. Does nothing on mobile, centers and
constrains width on desktop.

```tsx
// components/ScreenContainer.tsx
export function ScreenContainer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      {children}
    </div>
  )
}
```

### Token usage

Always use T values. Never hardcode colors, radii, or shadows.

```ts
// web
<div style={{ backgroundColor: T.surface, borderRadius: T.r.md }}>

// React Native later — identical values, different tag
<View style={{ backgroundColor: T.surface, borderRadius: T.r.md }}>
```

### Mobile browser fixes (globals.css)

These are not responsive — they're mobile browser quirks. Apply globally once.

```css
/* prevent iOS zoom on input focus */
input, select, textarea { font-size: 16px; }

/* full height including dynamic browser chrome */
.screen { min-height: 100dvh; }

/* sit above iOS home indicator */
.tab-bar { padding-bottom: env(safe-area-inset-bottom); }

/* respect iOS notch */
.header { padding-top: env(safe-area-inset-top); }
```

### Amount input

```tsx
<input
  inputMode="decimal"   // numeric keyboard on mobile, keeps decimal point
  pattern="[0-9]*"      // iOS numeric keyboard fallback
  placeholder="0.00"
  value={amount}
  onChange={e => setAmount(e.target.value)}
/>
```

---

## Summary

| Concern | Solution |
|---|---|
| Screen behavior | Hooks in `hooks/` — written once, reused anywhere |
| Navigation callbacks | `onSuccess` params — never `router.push` inside a hook |
| Layout switching | `useBreakpoint` — one file, swap for React Native |
| Nav structure | `Shell` renders `<TabBar>` or `<Sidebar>` |
| Forms | `useAddExpenseNav` — full-screen page or modal |
| Content width | `ScreenContainer` — max-width 600, centered |
| Styling | T tokens + inline styles or CSS modules. No Tailwind. |
| Mobile quirks | `env(safe-area-inset-*)`, `100dvh`, `font-size: 16px` on inputs |
| Amount input | `inputMode="decimal"` |
