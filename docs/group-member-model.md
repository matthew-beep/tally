# Group Member Model

## Core principle

Everyone in a group is a group member first. A Tally profile is an optional upgrade on top of that — not a prerequisite. Guests are passive placeholders: they appear in splits and balances but cannot take any action until they claim a profile.

---

## Who can do what

| Action | Real user (has profile) | Guest (no profile) |
|---|---|---|
| Add expense | ✓ | ✗ |
| Be included in a split | ✓ | ✓ |
| Settle up | ✓ | ✗ |
| See balances | ✓ | ✗ |
| Receive notifications | ✓ | ✗ |

---

## Schema

### group_members

Everyone in a group — real users and guests — is a row here. `user_id` is the optional link to a Tally profile.

```sql
group_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,          -- display name in this group
  user_id     uuid REFERENCES profiles ON DELETE SET NULL, -- null for guests
  invited_by  uuid REFERENCES profiles,
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('pending', 'active', 'left')),
  joined_at   timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)          -- prevents duplicate real-user rows per group
)
```

### expense_splits

References `group_members.id` — not profiles. Splits are always group-scoped.

```sql
expense_splits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id      uuid REFERENCES expenses ON DELETE CASCADE NOT NULL,
  group_member_id uuid REFERENCES group_members NOT NULL,
  owed_amount     numeric(10,2) NOT NULL
)
```

### expenses

`paid_by` references `group_members.id` — the payer is always a member of the group the expense belongs to. Only members with a linked profile can actually create an expense (enforced at app layer).

```sql
expenses (
  ...
  paid_by uuid REFERENCES group_members NOT NULL,
  ...
)
```

### settlements

Both parties are group members. Only members with a linked profile can initiate or confirm a settlement (enforced at app layer).

```sql
settlements (
  ...
  from_member_id uuid REFERENCES group_members NOT NULL,
  to_member_id   uuid REFERENCES group_members NOT NULL,
  ...
)
```

---

## Identity

### Within a group
Everything keys by `group_members.id`. Splits, payments, and settlements are all group-scoped.

### Cross-group (real users only)
`group_members.user_id` is the stable cross-group identity. To aggregate "Sam owes $50 across 3 groups", resolve each group's `group_members.user_id` to the same profile ID. This is an in-memory lookup on data already loaded at app start — no extra DB round trip.

### Guests
Guest `group_members` rows have `user_id = NULL`. They are inherently group-scoped — no cross-group identity until claimed.

---

## Claiming

**Status: designed, not yet implemented.** Step-by-step UX is in
`docs/flows.md` § Claim a guest seat — this section covers the schema and
why it's shaped this way.

Every `group_members` row carries a `seat_token`, a DB column default
(`DEFAULT substr(md5(random()::text), 1, 12)`) generated unconditionally on
insert — same mechanism as `groups.invite_token`. It's not guest-specific at
generation time; a real member's row gets one too, it's just permanently
inert there. Generating it unconditionally means none of the three places a
guest row is created or converted (`/api/groups/create`, `/api/groups/members/add`,
the decline-to-guest conversion in `/api/invite/decline`) need any special
handling — the column just exists.

A shareable `/claim/:seat_token` link resolves to one specific seat and
performs:

```sql
UPDATE group_members
SET user_id = :new_profile_id, name = :profile_name
WHERE seat_token = :token AND user_id IS NULL;
```

All existing `expense_splits`, `expenses.paid_by`, and `settlements` already reference `group_members.id` — nothing else needs to move.

The `WHERE user_id IS NULL` clause is the actual security boundary, not
token secrecy after the fact — once a seat is claimed, its token can never
claim anything again regardless of who still holds it. That's why the token
is deliberately never nulled out on claim: a reused link can report "already
claimed by X" instead of a generic error, at no cost to security.

No cross-group identity is implied by claiming. The same real person added
as a guest in three different groups holds three unrelated seats with three
independent tokens — claiming one has no effect on the others.

---

## Balance calculation

```ts
// group_members already loaded at app start — this is an in-memory lookup
const effectiveId = (gmId: string) =>
  memberMap[gmId]?.user_id ?? gmId  // real user → profile id, guest → group_member id

// Balance keys are profile IDs for real users, group_member IDs for guests
// Cross-group aggregation works naturally for real users via user_id
```

---

## Migration from current schema

1. Add surrogate `id` to `group_members`, drop composite PK
2. Add `name` column to `group_members` (populated from profiles)
3. Make `group_members.user_id` nullable
4. Map `expense_splits.user_id` → `group_member_id` (join through group + user to find the right group_members row)
5. Map `expenses.paid_by` (profile id) → correct `group_members.id`
6. Add `settlements.from_member_id` / `to_member_id`, drop `from_user` / `to_user`
