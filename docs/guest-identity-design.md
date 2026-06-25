# Guest Identity Design

## The Problem

When a user adds someone without a Tally account to a group, we need to track that person so they can be included in expense splits and balances. The question is where and how to store that identity — and when to create it.

### Current implementation

`createGuestProfile` inserts a row into `profiles` with `user_id = NULL` and `status = 'guest'` from the browser client. This fails silently because there is no INSERT policy on `profiles` — RLS defaults to DENY for any operation without an explicit policy.

This means:
- Group creation with guests throws an error after the group is already created
- The user sees an error and retries, creating a duplicate group
- Guests can never be added from the group detail page either

---

## The Deeper Design Question

The bug surfaced a more fundamental question: **where does a guest's identity live, and when does it get created?**

### Current schema intent (CLAUDE.md)

```sql
profiles
  id           uuid PRIMARY KEY
  user_id      uuid NULLABLE -- NULL for guests
  name         text
  status       text -- 'active' | 'guest'
```

Guests are full `profiles` rows created immediately when added to a group. `expense_splits` references `profiles.id`. On claim, `user_id` is set to the new auth user and `status` flipped to `active`.

### The multi-group problem

If the same real person gets added as a guest in 3 different groups, 3 separate guest profile rows are created. They claim from one group — the other two are orphaned. There is no way to know those 3 guest rows represent the same person before they claim.

---

## Approaches

### Option A — Fix RLS, keep profiles rows (minimal change)

Add an INSERT policy to `profiles` allowing authenticated users to insert rows where `user_id IS NULL`:

```sql
CREATE POLICY "profiles: authenticated can insert guests"
ON profiles FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id IS NULL);
```

Also update the SELECT policy to allow group members to see guest profiles in their groups:

```sql
ALTER POLICY "profiles: anyone can read active"
ON profiles USING (
  status = 'active'
  OR (
    status = 'guest' AND id IN (
      SELECT user_id FROM group_members
      WHERE group_id IN (SELECT get_my_group_ids())
    )
  )
);
```

**Pros:** Minimal code change. Claiming is simple — one UPDATE on the profile row.

**Cons:** Multi-group orphan problem. Guest profiles accumulate in the DB unclaimed. No way to deduplicate the same real person across groups before they claim.

---

### Option B — Nullable `user_id` on `group_members`, profile created on claim

Guests live only on `group_members`. No profile row until they claim.

```sql
group_members
  id          uuid PRIMARY KEY  -- new surrogate PK
  group_id    uuid REFERENCES groups
  user_id     uuid NULLABLE REFERENCES profiles  -- null for guests
  guest_name  text              -- set when user_id is null
  ...
```

`expense_splits` references `group_members.id` instead of `profiles.id`:

```sql
expense_splits
  id              uuid PRIMARY KEY
  expense_id      uuid REFERENCES expenses
  group_member_id uuid REFERENCES group_members  -- was: user_id → profiles
  owed_amount     numeric
```

On claim: set `group_members.user_id` to the new profile ID. `expense_splits` already points to the `group_members` row — no migration of split data needed.

**Pros:**
- No orphaned guest profiles
- Guests are correctly scoped to a group — "John from camping" is not a global identity until he claims
- Profile creation is deferred until it actually means something
- RLS on `group_members` INSERT already enforces that only active group members can add guests

**Cons:**
- Schema change to `expense_splits` — references `group_members.id` instead of `profiles.id`
- Balance queries join through `group_members` instead of directly through `profiles`
- Cross-group balance aggregation for real users still works (join through `user_id → profiles`), but guest balances are inherently group-scoped until claimed
- Bigger refactor — touches migrations, query hooks, balance calculation

---

## Current thinking

Option B is the more correct model conceptually — guests are group-scoped until they claim. Option A is faster to ship but carries the orphan problem forward.

The decision gate: **how important is the claiming flow for MVP?**

If claiming is Phase 2+, Option A is fine to ship now and migrate later. If claiming is Phase 1, Option B avoids a painful migration down the road.
