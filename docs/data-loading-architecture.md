# Data Loading Architecture

## Current state

Every query that needs the user's group list runs its own waterfall:

```
getAuthUser → group_members (groupIds) → actual data
getAuthUser → group_members (groupIds) → actual data
getAuthUser → group_members (groupIds) → actual data
```

### Home screen (`/`)

| Hook | Round-trips | What it fetches |
|---|---|---|
| `useGlobalBalances` | auth → memberships → parallel(expenses, settlements, members) → profiles | Full balance math across all groups |
| `useRecentActivity` | auth → memberships → expenses with group+payer joins | Latest 15 expenses for activity panel |

Two independent membership fetches. Expenses fetched twice — different shapes, same underlying rows.

### Groups page (`/groups`)

| Hook | Round-trips |
|---|---|
| `useGroups` | auth → group_members with group join |

Third membership fetch, separate from the two above.

### Activity page (`/activity`)

| Hook | Round-trips |
|---|---|
| `useAllActivity` | auth → memberships → parallel(expenses, settlements) |

Fourth membership fetch.

### Group detail (`/groups/:id`)

| Hook | Round-trips |
|---|---|
| `useGroup` | single group row |
| `useGroupMembers` | members + profiles for that group |
| `useExpenses` | expenses + splits for that group |
| `useSettlements` | settlements for that group |

These are scoped to a single group so the membership lookup isn't needed — fine as-is.

---

## Problems

**Duplicate membership fetches.** `useGlobalBalances`, `useRecentActivity`, `useAllActivity`, and `useGroups` all independently hit `group_members` for the same user. On initial load these fire concurrently, so 3–4 identical queries go out at the same time.

**Waterfall structure.** Every query has a sequential dependency: auth → memberships → actual data. The data fetch can't start until memberships resolve.

**Expenses fetched twice on home screen.** `useGlobalBalances` fetches expenses as `(group_id, paid_by, splits)` for balance math. `useRecentActivity` fetches the same expense rows again with different joins for the UI. Different enough shapes that they can't share a cache entry.

---

## Proposed approach

### 1. Shared `useMyGroupIds` hook

Extract the membership lookup into its own query with a stable cache key. Any hook that calls it gets the result from cache after the first resolution — no duplicate DB hits.

```ts
// queries/useMyGroupIds.ts
export function useMyGroupIds() {
  return useQuery({
    queryKey: ['my-group-ids'],
    queryFn: async () => {
      const user = await getAuthUser(supabase)
      const { data } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      return data?.map(m => m.group_id) ?? []
    },
    staleTime: 60_000,
  })
}
```

`useGlobalBalances`, `useRecentActivity`, `useAllActivity`, and `useGroups` all call `useMyGroupIds()` and wait on `enabled: groupIds !== undefined` before firing their data query. The first caller fetches, the rest read from cache.

### 2. `useGroups` can piggyback on `useMyGroupIds`

`useGroups` currently fetches `group_members` with a `groups(*)` join. With `useMyGroupIds` cached, it can skip the membership query and just fetch `groups` directly by ID.

```ts
export function useGroups() {
  const { data: groupIds } = useMyGroupIds()
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => supabase.from('groups').select('*').in('id', groupIds!),
    enabled: !!groupIds?.length,
  })
}
```

### 3. Consider merging `useGlobalBalances` and `useRecentActivity`

Both are only used on the home screen. They share the same `groupIds` dependency and both hit expenses. Merging them into one query avoids the duplicate expense fetch and eliminates one waterfall chain entirely.

The merged query returns `{ balances, recentExpenses }` — home screen components destructure what they need.

---

## Invalidation rules (unchanged)

Any mutation that changes group membership or financial data must invalidate the affected keys:

| Event | Keys to invalidate |
|---|---|
| Add/remove expense | `['expenses', groupId]`, `['global-balances']`, `['recent-activity']`, `['all-activity']` |
| Settle up | `['settlements', groupId]`, `['global-balances']`, `['all-activity']` |
| Create group | `['groups']`, `['my-group-ids']` |
| Delete group | `['groups']`, `['my-group-ids']`, `['global-balances']`, `['all-activity']` |
| Accept/decline invite | `['groups']`, `['my-group-ids']`, `['global-balances']` |

`['my-group-ids']` must be invalidated any time group membership changes — it's the root dependency for all downstream queries.
