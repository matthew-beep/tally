# Data Loading Architecture

_Rewritten 2026-07-18. This describes the as-built architecture after the
per-group-canonical migration. The previous version of this doc described
the pre-migration state (duplicate membership fetches, per-screen aggregate
queries) and proposed a milder fix; that proposal was superseded by the
design below. History in git._

## The model

Per-group cache entries are canonical. Everything cross-group is a pure
client-side fold over them — computed on render, never stored.

```
['groups']                            ← root: my groups (rows + ids)
    │
    ▼ fan-out (useAllGroupData)
['expenses', gid]                     ← canonical, per group
['settlements', gid]                  ← canonical, per group
['group_members', gid]                ← canonical, per group
    │
    ▼ pure folds (lib/balance.ts, lib/feed.ts)
calcNetBalances · calcPairwiseNets · summarizeBalances · mergeFeed
    │
    ▼ derivation hooks (no cache keys of their own)
useGlobalBalances · useAllActivity
    │
    ▼ screens
home hero + person rows · groups list badges · activity feed · group detail
```

Two principles, extending "balances are computed, never stored":

- **Aggregates are computed, never stored.** There is no cached cross-group
  object. The dashboard's numbers are `useMemo` folds over whatever
  per-group entries the screen subscribes to.
- **Identity translation happens between layers, never inside them.** The
  pure functions operate in seat space (`group_members.id`). The dashboard
  derivations translate seat → profile id (`effectiveId`) at the merge, so
  real users aggregate across groups while guests stay seat-scoped.

## The pieces

| Piece | File | Role |
|---|---|---|
| `groupsQueryOptions` / `useGroups` | `queries/useGroups.ts` | Root query `['groups']`: my active memberships joined to group rows. Mounted in the dashboard shell (Sidebar), so it's warm on every page. |
| `useMyGroupIds` | `queries/useMyGroupIds.ts` | Ids view over `['groups']` via `select` — not a query of its own, so ids and metadata can never disagree. Structural sharing keeps the ids array referentially stable across metadata-only refetches. Swap back to a dedicated skinny query if `['groups']` ever gets heavy. |
| `expensesQueryOptions` etc. | `useExpenses` / `useSettlements` / `useGroups` | Shared query options (key + fetcher) used by both the single-group hooks and the fan-out — this is what makes the caches canonical. |
| `useAllGroupData` | `queries/useAllGroupData.ts` | `useQueries` fan-out over ids × {expenses, settlements, members}. Returns byGroup records + aggregate `isLoading`. |
| `useGlobalBalances` | `queries/useGlobalBalances.ts` | Derivation: per-group `calcNetBalances` + `calcPairwiseNets` (seat space) → translate → `net`, `netPerGroup`, `pairwisePerGroup`; hero grosses from `summarizeBalances` (no `Math.max(0)` floors — hero equals the sum of person rows). `profileMap` comes from the members joins; no profiles query. |
| `useAllActivity` | `queries/useActivity.ts` | Derivation: `mergeFeed` per group → `ActivityItem` shaping (names via `lib/memberDisplay`) → bucketed by group. |

## What loads when

- **Home / groups list / activity** (cross-group): `['groups']` resolves →
  fan-out fires in parallel → folds compute. First screen pays for the
  fetch; every later navigation reads warm cache (revalidating per
  `staleTime`/refocus).
- **Group detail** (deep link): four scoped queries only —
  `['groups', id]`, `['group_members', id]`, `['expenses', id]`,
  `['settlements', id]`. No root, no fan-out, other groups untouched.
  Navigating out to a cross-group screen later reuses this group's warm
  entries.
- **Auth/authz**: middleware redirects unauthenticated users before render;
  RLS returns empty results (not errors) for groups you're not in — the
  folds compute over empty arrays and the page shows not-found.

## Invalidation rules

Mutations invalidate only the small keys they touch; every aggregate
recomputes automatically because it derives from those caches.

| Event | Keys to invalidate |
|---|---|
| Add / edit / delete expense | `['expenses', gid]` (+ `['settlements', gid]` where relevant) |
| Settle up / confirm / deny | `['settlements', gid]`, `['notifications']` |
| Membership change (create/delete group, accept/decline invite, leave) | `['groups']`, `['group_members', gid]`, `['notifications']` as relevant |

`['groups']` is the root: invalidating it prefix-matches `['groups', id]`
detail entries too, and a changed ids result re-drives the fan-out. There
are no aggregate cache keys to remember — that bug class is gone.

## Constraints and escape hatches

- **The canonical expense/settlement caches can never be paginated** while
  balance math runs client-side — balances need complete history. When
  history size hurts (payload/recompute, not query time), the exits are:
  balances move server-side (RPC/view summing splits, mirroring the
  `lib/balance.ts` functions, tested against them), and the feed becomes a
  separate paginated `UNION ALL` query. Both slot in per-surface without
  changing this architecture. Until then, client folds keep optimistic
  updates trivial and the math in one tested language.
- **Fan-out request count** scales with group count (3 requests/group,
  parallel over HTTP/2). Fine at realistic group counts; batch-and-seed
  (`setQueryData` per group from one batched fetch) is the escape hatch if
  it ever isn't.
- **Optional warmth**: shell-level data (`['groups']`, recents) is already
  mounted on every dashboard page via Sidebar/comboboxes. Idle or
  intent-based prefetch of per-group money data can be layered on with
  `queryClient.prefetchQuery` without any architectural change.
