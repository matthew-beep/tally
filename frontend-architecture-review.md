# Frontend Architecture — Review & Decisions

> Handoff notes from a Claude Code session reviewing `tally-frontend-architecture.md`.
> Purpose: pick this up on another device. Captures the gap between the doc and the
> code, the concrete fixes the doc needs, and the decision on the hooks layer.

---

## TL;DR

- `tally-frontend-architecture.md` describes a **target** architecture the code does
  **not** follow yet. There is no `src/hooks/` directory; screens are fat components.
- The hooks strategy is **good** — extract logic out of components — but apply it
  **selectively**, not as a blanket "every screen gets a hook" rule.
- The doc has **two correctness bugs** that contradict `CLAUDE.md` / the actual code
  (notifications + category). Those are must-fix. The rest are consistency cleanups.
- Highest-value first step: extract `useAddExpense` from
  `src/app/(dashboard)/groups/[id]/add/page.tsx` as the worked example.

---

## Current state of the code (as of this review)

- `src/queries/` exists: `useExpenses`, `useGroups`, `useMembers`, `useProfile`,
  `useSettlements`, `useGlobalBalances`.
- `src/hooks/` does **not** exist.
- `lib/balance.ts` (`calcNetBalances`, `simplifyDebts`), `lib/splits.ts`,
  `lib/categories.ts` all exist.
- Shell reality: `components/AppShell.tsx` is **mobile-only** (`TabBar` + `ModeSheet`,
  hardcoded `paddingBottom: 90`, no breakpoint branch). Desktop is handled separately
  via `components/dashboard/Sidebar.tsx` + `DashboardPage.tsx`. This is **not** the
  single breakpoint-branching `Shell` the doc describes.
- `groups/[id]/add/page.tsx` is the worst fat component: 9 `useState`, 3
  query/mutation hooks, 2 `useEffect`, and the whole `handleSave` split-building
  routine inline — exactly the logic the doc says belongs in `useAddExpense`.

---

## Must-fix bugs in the doc

### 1. Hook specs contradict the "notifications are trigger-only" rule
`CLAUDE.md`: *"App code never writes to `notifications` directly. All notification
inserts happen via Postgres triggers."*

- `useSettleUp.submit()` spec says it "creates `settlement_confirm` notification for
  payee" — **wrong**. The `notify_settlement_created` trigger does this. The hook
  should only INSERT the settlement.
- `useActivity.confirmSettlement` says it "writes `settlement_confirmed` notification
  to payer" — **wrong**. The `notify_settlement_confirmed` trigger does this. The hook
  should only UPDATE `status = 'confirmed'`.
- `denySettlement` similarly: just DELETE the row; `notify_settlement_denied` fires.

As written, the doc would produce **double notifications**. Strip all "writes
notification" language from the hook specs.

### 2. `category` cannot be purely derived
`useAddExpense` lists `category` under **Derived** as `detectCategory(description)`.
But the UX (and the real component, via a `manualCategory` flag) lets the user tap to
override the auto-detected category. A pure-derived value can't be overridden.
It must be `useState` seeded from `detectCategory`, plus the override flag.

---

## Consistency cleanups the doc needs

3. **Naming collision.** `queries/useExpenses.ts` already exports `useAddExpense`
   (raw mutation). The doc proposes a *second* `useAddExpense` in `hooks/`. Same for
   `useProfile` (queries has `useCurrentProfile`). Pick a convention and document it,
   e.g. `queries/` → `useAddExpenseMutation`, `hooks/` → `useAddExpense`.

4. **Spec thinner than feature.** `useAddExpense` spec omits `splitType`,
   `exactAmounts`, and split-building, but the real screen supports equal *and* exact
   splits. (Aside: `CLAUDE.md` says MVP is "equal split only" yet code already does
   exact — scope drift to resolve separately. The doc should at least match the code.)

5. **Checklist contradicts the doc.** Definition-of-done says "No `useState`,
   `useQuery`, or `useMutation` in the component file," but the "what goes where"
   section explicitly keeps `useState` for menus/hover/tooltips in components. Change
   to: "no *data/business* `useState`; presentational UI state is fine."

6. **Shell mismatch.** Reconcile the doc's breakpoint-branching `Shell` with the
   actual two-path reality (`AppShell` mobile + `Sidebar`/`DashboardPage` desktop):
   either refactor code to the doc, or rewrite the doc to describe what's built.

7. **`status = 'active'` filtering is invisible in the hook specs.** `CLAUDE.md`
   treats it as an invariant on every `group_members` query. None of `useGroupDetail`,
   `useMemberSearch`, `useHome` mention it. State it explicitly in the data specs.

8. **Double width constraint (minor).** `Shell` desktopMain `maxWidth: 960` +
   `padding: 32` *and* `ScreenContainer` `maxWidth: 600`. Decide which owns width;
   note the overlap.

---

## One thing the doc oversells: React Native portability

The claim *"identical values, different tag"* is too strong.

- **Portable:** the design **token values** (colors, radii) → `StyleSheet.create()`.
- **NOT portable:** `cursor`, `outline`, `:hover` (you deliberately keep hover state
  in components — that styling won't port), `boxShadow` string syntax, `transition`,
  `100dvh`, `env(safe-area-inset-*)`.

Be honest in the doc: the design **tokens** are portable; the **style application**
is a real rewrite. Don't plan the RN migration as a swap.

---

## Decision: should logic move into hooks? — Yes, but selectively

The strategy is right. The thing to push back on is the *rule*
("delete all JSX, is there logic left? → hook"), which manufactures wrapper hooks
around screens that are 90% data fetching.

**Extract these — they earn their keep** (real form/interaction state + derived
validation + mutation orchestration, worth testing in isolation):

- `useAddExpense` — poster child. Start here.
- `useSettleUp` — pre-fill from debt simplification, validation.
- `useCreateGroup` — form + mutation.
- `useMemberSearch` — debounce, three search modes, query gating.

**Don't force these — mostly ceremony** (doc labels them "No local state. Pure
composition"). They wrap existing query hooks + a couple derived values:

- `useGroupDetail`, `useGroupsList`, `useHome`, `useActivity`

For these: keep derived math in `lib/` (already done for balances), call query hooks
directly in the component, and `useMemo` the derived values. Add a screen hook only
when a **second consumer** actually needs it. (`useActivity` is borderline-justified
because home preview + activity tab both consume it — that's a legit reuse case.
`useGroupsList` has no second consumer.)

**Revised rule:** extract when there's form/interaction state or genuine reuse;
otherwise call queries directly and `useMemo` the derived values.

---

## Next step

Do the `useAddExpense` extraction from `groups/[id]/add/page.tsx` as a worked example
— it's the highest-value one and makes the pattern concrete for the rest. Remember
while extracting:
- `category` = state seeded from `detectCategory`, not pure derived (bug #2)
- no notification writes — triggers handle it (bug #1)
- include `splitType` / `exactAmounts` / split-building (gap #4)
- navigation via `onSuccess` callback, not `router` inside the hook
