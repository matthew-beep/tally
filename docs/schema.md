# Database schema (as built)

Source of truth: `supabase/migrations/*.sql` applied on top of the base schema.
TypeScript mirrors live in `src/types/index.ts`.

## Identity model — the one thing to internalize

There are **two identity layers**, and every table picks exactly one:

1. **`profiles`** — a person across the whole app. For real accounts,
   `profiles.id` **equals** `auth.users.id` (created 1:1 by the
   `handle_new_user` trigger on signup). Guest profiles (no login) get a
   random UUID and `status = 'guest'`.
2. **`group_members`** — a person's *seat in one group*. Surrogate PK
   (`group_members.id`), denormalized `name`, nullable `user_id` → profile.
   A guest seat is simply a row with `user_id = NULL` — no profile needed.

**All money is keyed by the seat, not the person** (migration
`20260621000000_group_member_model.sql`):

- `expenses.paid_by` → `group_members.id`
- `expense_splits.group_member_id` → `group_members.id`
- `settlements.from_member_id` / `to_member_id` → `group_members.id`

**Cross-group concerns are keyed by the person:**

- `notifications.recipient_id` → `profiles.id`
- `expense_history.edited_by` → `profiles.id`
- `groups.created_by`, `group_members.invited_by` → `profiles.id`
- member search / recents return `profiles`

Balance math within a group operates on member IDs. Cross-group aggregation
(`useGlobalBalances`) resolves member → profile via `user_id`, so a person's
balances line up across groups; guests aggregate by their member ID since they
exist in only one group.

> ⚠️ **Drift from CLAUDE.md**: the spec describes `expense_splits.user_id` and
> `settlements.from_user/to_user` referencing profiles, and a separate
> `profiles.user_id` column. None of that survived. Trust this doc.

## Tables

```sql
profiles (
  id           uuid PK,            -- = auth.users.id for real users; random for guests
  name         text NOT NULL,      -- from Google, never changes
  display_name text,               -- user-set; UI renders display_name ?? name
  handle       text UNIQUE,        -- lowercase @handle, NULL until onboarding completes
  email        text,               -- search only, never shown to other users
  avatar_url   text,
  add_code     text UNIQUE,        -- permanent 8-char QR/share code
  status       text DEFAULT 'active',  -- 'active' | 'guest'
  claim_token  text UNIQUE,        -- unused — scaffolding for a superseded guest
                                   -- model (guest-as-profiles-row). The actual
                                   -- claim mechanism is group_members.seat_token
                                   -- (see flows.md § Claim a guest seat)
  created_at   timestamptz
)

groups (
  id           uuid PK,
  name         text NOT NULL,
  emoji        text DEFAULT '💸',
  created_by   uuid → profiles NOT NULL,
  invite_token text UNIQUE,        -- /invite/:token, auto-generated
  created_at   timestamptz
)

group_members (
  id          uuid PK,             -- surrogate key; THE key for all money rows
  group_id    uuid → groups ON DELETE CASCADE,
  user_id     uuid → profiles,     -- NULL = guest seat
  name        text NOT NULL,       -- denormalized display name (works for guests)
  status      text DEFAULT 'pending',  -- 'pending' | 'active' | 'left'
  invited_by  uuid → profiles,
  joined_at   timestamptz,
  seat_token  text UNIQUE             -- claim-link token, DB default, every
                                      -- row gets one — see flows.md § Claim
                                      -- a guest seat (built)
  -- UNIQUE (group_id, user_id) WHERE user_id IS NOT NULL
  --   (partial: many guest rows per group are allowed)
)

expenses (
  id            uuid PK,
  group_id      uuid → groups ON DELETE CASCADE NOT NULL,
  paid_by       uuid → group_members NOT NULL,
  description   text NOT NULL,
  amount        numeric(10,2) CHECK (amount > 0),
  currency_code text DEFAULT 'USD',
  split_type    text CHECK IN ('equal','exact','percentage','itemized'),
  category      text,              -- emoji, e.g. '🍽️'
  tax, tip      numeric(10,2) DEFAULT 0,   -- itemized only (not yet used)
  expense_date  date DEFAULT CURRENT_DATE, -- user-set "when it happened"
  created_at    timestamptz,
  updated_at    timestamptz,       -- touched by trigger on every UPDATE
  deleted_at    timestamptz,       -- soft delete; queries must filter IS NULL
  share_token   text UNIQUE        -- public share link (page not wired yet)
)

expense_splits (
  id              uuid PK,
  expense_id      uuid → expenses ON DELETE CASCADE NOT NULL,
  group_member_id uuid → group_members ON DELETE CASCADE NOT NULL,
  owed_amount     numeric(10,2) NOT NULL,  -- splits must sum to expenses.amount
  UNIQUE (expense_id, group_member_id)     -- added 2026-07-19: turns a silent
                                           -- RLS no-op on edit into a loud error
)

settlements (
  id             uuid PK,
  group_id       uuid → groups ON DELETE CASCADE NOT NULL,
  from_member_id uuid → group_members NOT NULL,  -- who paid
  to_member_id   uuid → group_members NOT NULL,  -- who was owed
  amount         numeric(10,2) CHECK (amount > 0),
  note           text,
  settled_date   date,             -- when payment happened (user-set)
  created_at     timestamptz,      -- when recorded (activity sort key)
  status         text DEFAULT 'pending', -- 'pending' | 'confirmed'; denial = DELETE
  batch_id       uuid NOT NULL DEFAULT gen_random_uuid()
                 -- added 20260808000000. The payment these rows allocate: one
                 -- transfer zeroing N groups writes N rows sharing a batch_id.
                 -- Universal, so a lone settlement is a batch of one. Status is
                 -- uniform across a batch (set by the sign of its net).
)

expense_history (
  id          uuid PK,
  expense_id  uuid → expenses ON DELETE CASCADE NOT NULL,
  edited_by   uuid → profiles NOT NULL,
  snapshot    jsonb NOT NULL,      -- full expenses row BEFORE the edit
  edited_at   timestamptz
)

notifications (
  id            uuid PK,
  recipient_id  uuid → profiles NOT NULL,
  type          text CHECK IN ('group_invite', 'group_invite_accepted',
                  'group_invite_declined', 'settlement_confirm',
                  'settlement_confirmed', 'settlement_recorded',
                  'settlement_denied'),
  settlement_id uuid → settlements ON DELETE CASCADE,  -- settlement types
  group_id      uuid → groups ON DELETE CASCADE,       -- invite types ONLY.
                                 -- notify_settlement_created() never stamps it,
                                 -- so it is always NULL on settlement rows —
                                 -- their group comes from the settlement's own
                                 -- group_id (NOT NULL), which is why
                                 -- useNotifications joins groups under the
                                 -- settlement as well as on the row itself.
  amount        numeric(10,2),   -- added 20260805010000. Denormalized off the
                                 -- settlement so it survives deletion —
                                 -- settlement_denied has no settlement to read.
  batch_id      uuid,            -- added 20260808000000. Stamped by the trigger,
                                 -- not joined through settlement_id (which is
                                 -- NULL for settlement_denied). NULL for invite
                                 -- types. Client groups the list by this; the
                                 -- unread count counts distinct values.
  read          boolean DEFAULT false,
  created_at    timestamptz
)
```

`expense_items` / `expense_item_assignments` (itemized splits) are designed in
CLAUDE.md but **do not exist yet** — itemized mode is a UI placeholder.

> The `create_group_with_members` RPC (from `20260617...`) was dead code —
> group creation goes through `POST /api/groups/create` — and broken under
> the member model. Dropped in `20260713000000_drop_stale_group_rpc.sql`.

## Triggers — app code never writes notifications or history

| Trigger | Table / event | Effect |
|---|---|---|
| `handle_new_user` | `auth.users` INSERT | Creates the matching `profiles` row (handle left NULL) |
| `touch_updated_at` | `expenses` UPDATE | Sets `updated_at = now()` — `updated_at != created_at` ⇒ "(edited)" |
| `log_expense_edit` | `expenses` BEFORE UPDATE | Snapshots the old row into `expense_history` |
| `notify_group_invite` | `group_members` INSERT | `group_invite` → invitee (skipped for guests: `user_id IS NULL`) |
| `notify_group_invite_accepted` | `group_members` UPDATE | Two branches (since `20260711_decline_to_guest`): pending→active **with `user_id` still set** → `group_invite_accepted` → `invited_by`; pending row with `user_id` cleared (decline-with-history → guest conversion) → `group_invite_declined` → `invited_by` |
| ~~`notify_group_invite_declined`~~ | — | **Gone.** Written for the old DELETE-based decline path and never had a trigger attached; dropped in `20260729000000`. Both decline paths now run through `notify_group_invite_accepted`'s second branch above. |
| `notify_settlement_created` | `settlements` INSERT | **Branches on `NEW.status`** (since `20260805000000`): `pending` (debtor recorded — "I paid you") → `settlement_confirm` → payee; `confirmed` (creditor recorded — "you paid me") → `settlement_recorded` → payer, informational. Recipient resolved via `group_members.user_id`; skipped for guests in either branch. Status carries the direction of the claim, so no `recorded_by` column is needed. |
| `notify_settlement_confirmed` | `settlements` UPDATE pending→confirmed | `settlement_confirmed` → payer |
| `notify_settlement_denied` | `settlements` DELETE of pending | `settlement_denied` → payer. Sets no `settlement_id` — the row is already gone and the FK would reject it (fixed `20260805010000`); `amount` and `batch_id` are read off `OLD` instead. |

All three settlement triggers stay `FOR EACH ROW` and stamp `NEW`/`OLD.batch_id`
onto the notification (since `20260808000000`). A payment spanning N groups
therefore produces N notification rows sharing one `batch_id`, and the client
collapses them into one card — grouping is client-side by design (TODO.md item
5 (e)), since a statement-level trigger emitting one row could not use
`settlement_id` and could not FK to `batch_id` either.

## RLS

All app tables have RLS on — fully audited against the live database
2026-07-19; the per-table policy summary and severity-ranked findings are
recorded in [review-todo.md](./review-todo.md) (RLS dashboard check).
Most policies still live only in the untracked base schema (dashboard);
a baseline snapshot (`npx supabase db pull`, see TODO → Prod readiness)
remains open, and until it lands the local dev DB does **not** match
prod policies — which is exactly how two silent critical bugs survived
testing (see `rls_critical_fixes` below).

Membership gating goes through `get_my_group_ids()`, a `SECURITY DEFINER`
helper (definer mode is what stops the `group_members` SELECT policy from
recursing into itself; `user_id = auth.uid()` is valid because
`profiles.id = auth.users.id`):

```sql
group_id IN (SELECT get_my_group_ids())
```

The helper **does** filter `status = 'active'`, so pending and left members
get no read access through it. This closes the finding scoped in
review-todo, whose two halves are both present in the baseline: the status
filter in the function (`20260721000000_baseline_schema.sql:41`) and the
`groups: pending invitee can preview` policy (line 766) that keeps invite
notifications able to show the group name. Corrected 2026-08-09 — this note
previously described the finding as open, which it hasn't been since the
baseline snapshot.

Two policies enforce the same status check inline rather than through the
helper — `expenses` UPDATE (line 714) and `expense_history` SELECT (line
724). Same result, but they won't follow if the helper's definition ever
changes.

Fixes worth knowing (all in `supabase/migrations/`):

- **`fix_expense_update_rls`** — any active group member may UPDATE any
  expense (edits + soft delete). The earlier payer-only policy made other
  members' deletes silently no-op.
- **`fix_expense_select_rls`** — the SELECT policy must **not** filter
  `deleted_at IS NULL`, or the soft-delete UPDATE rejects its own result row.
  Soft-delete filtering is a query-layer concern, enforced in every hook.
- **`rls_critical_fixes`** (2026-07-19, applied) — added the missing
  `group_members` UPDATE policy (without it, accept-invite's client-side
  status update silently matched 0 rows) and `expense_splits` DELETE
  policy (without it, expense edit's delete-then-reinsert kept old splits
  and doubled balances); deduped the one corrupted — soft-deleted —
  expense; added the `expense_splits` UNIQUE constraint; dropped the
  forgeable `notifications` INSERT policy (triggers are SECURITY DEFINER
  and need no policy). Applied manually via SQL editor: run
  `npx supabase migration repair --status applied 20260719000000` after
  linking, before any future `db push`.

## Invariants (enforced in code, not schema)

- **Balances are computed, never stored** — always derived from
  `expense_splits` + `settlements` (`src/lib/balance.ts`).
- **Soft delete** — every expense query feeding balances/activity filters
  `deleted_at IS NULL`. RLS does not do this for you.
- **Split sum** — `expense_splits` must sum exactly to `expenses.amount`;
  rounding remainder goes to the payer. All split construction and rescaling
  lives in `src/lib/splits.ts` (`makeEqualSplits` / `makePercentSplits` /
  `makeExactSplits` / `rescaleSplits`), covered by `splits.test.ts`.
- **Pending settlements count** toward balances (optimistic); confirmation is
  a trust indicator, not a ledger event.
- **Handles** are stored lowercase; search with `ilike`.
- **Member status** — every `group_members` read filters on status.
  `'active'` for balances/lists; group detail includes `'pending'`
  deliberately (you can split with someone before they accept — pending gates
  consent/visibility, not expense participation). `'left'` rows are preserved
  so history stays intact.
