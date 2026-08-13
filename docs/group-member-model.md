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

**Status: built.** Step-by-step UX (both paths) is in `docs/flows.md` §
Claim a guest seat — this section covers the schema and RLS rationale.

Every `group_members` row carries a `seat_token`, a DB column default
(`DEFAULT substr(md5(random()::text), 1, 12)`) generated unconditionally on
insert — same mechanism as `groups.invite_token`. It's not guest-specific at
generation time; a real member's row gets one too, it's just permanently
inert there. Generating it unconditionally means none of the three places a
guest row is created or converted (`/api/groups/create`, `/api/groups/members/add`,
the decline-to-guest conversion in `/api/invite/decline`) need any special
handling — the column just exists.

There are two independent ways a seat gets claimed:

**Path A — self-serve, via `claim_seat(token)`.** A guest's own claim link
(`/claim/:seat_token`) is opened by the guest themselves; clicking through
and confirming is their own consent, same logic as accepting an invite link.
The write is a `SECURITY DEFINER` SQL function, **not** a plain client
`UPDATE` under an RLS policy — this was tried first and doesn't work: RLS
requires SELECT visibility on a row before an UPDATE policy is even
consulted, and nothing grants a fresh claimer visibility into a seat whose
`user_id` is still `NULL` (they're not a member, and no "own row" policy
applies to a row that isn't theirs yet). A same-shaped `USING (user_id IS
NULL) WITH CHECK (user_id = auth.uid())` policy was verified against local
Postgres to silently match zero rows — no error, just a no-op that reads as
"already claimed" to the user. `claim_seat` runs with elevated privilege
internally instead:

```sql
CREATE FUNCTION claim_seat(token text) RETURNS TABLE(id uuid, group_id uuid)
LANGUAGE plpgsql SECURITY DEFINER AS $$
  UPDATE group_members
  SET user_id = auth.uid(), name = <claimer's display_name ?? name>
  WHERE seat_token = token AND user_id IS NULL AND status = 'active'
  RETURNING id, group_id;
$$;
```

Granted to `authenticated` only (claiming requires a session), unlike the
preview RPC (`get_seat_by_claim_token`, granted to `anon` too) which must
work pre-login so a dead link can be rejected before OAuth.

**Path B — assisted, via `POST /api/groups/members/claim-invite`.** An active
member searches for and attaches a *specific* known Tally user to a guest
seat. Because the member doing the attaching isn't the one whose identity
and financial history are being reassigned, this does **not** merge
immediately — it requires the target's confirmation, the same rule CLAUDE.md
already applies to search-based member adds. The route (service-role,
after checking the caller is an active member) does:

```sql
UPDATE group_members
SET user_id = :profileId, status = 'pending', invited_by = :caller, name = :targetDisplayName
WHERE id = :memberId AND group_id = :groupId AND user_id IS NULL;
```

— an `UPDATE` on the existing seat, not an `INSERT`, so `group_members.id`
(and everything keyed to it) is unchanged. A trigger,
`on_group_member_seat_invited`, fires on this transition (`OLD.user_id IS
NULL AND NEW.user_id IS NOT NULL AND NEW.status = 'pending'`) and reuses
`notify_group_invite()` unchanged to notify the target. They accept/decline
through the ordinary pending-invite flow from there.

All existing `expense_splits`, `expenses.paid_by`, and `settlements` already reference `group_members.id` — nothing else needs to move, on either path.

**The `WHERE user_id IS NULL` clause is the actual security boundary for
both paths, not token secrecy after the fact** — once a seat is claimed (or
has a pending Path B invite attached), its token can't claim or be
re-invited by either path regardless of who still holds it. That's why the
token is deliberately never nulled out on claim: a reused link can report
"already claimed" instead of a generic error, at no cost to security.

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
