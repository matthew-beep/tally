# Tally — Database Schema

Supabase (Postgres). Run `setup.sql` in the SQL Editor to create everything from scratch.

---

## Tables

### `profiles`
Extends `auth.users`. Auto-created by the `on_auth_user_created` trigger on Google sign-in.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Internal FK target — never shown to users |
| `user_id` | uuid → auth.users | `NULL` for guest profiles (Phase 2) |
| `name` | text | From Google. Never changes. |
| `display_name` | text | User-set. Shown everywhere in UI. Falls back to `name`. |
| `email` | text | From Google. Search key only — never returned to client. |
| `avatar_url` | text | From Google profile photo. |
| `add_code` | text UNIQUE | 8-char slug. QR code encodes `tally.app/add/:add_code`. Auto-generated. |
| `status` | text | `'active'` or `'guest'`. Default `'active'`. |
| `claim_token` | text UNIQUE | Guest claim path (Phase 2). |
| `created_at` | timestamptz | |

**Always render names as:** `display_name ?? name`

**RLS:** Any authenticated user can SELECT active profiles (needed for member search). Users can only UPDATE their own row.

---

### `groups`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `emoji` | text | Default `'💸'` |
| `created_by` | uuid → profiles | |
| `invite_token` | text UNIQUE | 12-char slug. Powers `/invite/:token` join link. Auto-generated. |
| `created_at` | timestamptz | |

**RLS:** Visible to group members only. Any authenticated user can INSERT.

---

### `group_members`

| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid → groups CASCADE | PK |
| `user_id` | uuid → profiles CASCADE | PK |
| `joined_at` | timestamptz | |

Composite PK `(group_id, user_id)`. Joining a group via invite link = INSERT here.

**RLS:** Visible to other members of the same group. Any authenticated user can INSERT. Users can DELETE their own row (leave group).

---

### `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `group_id` | uuid → groups CASCADE | |
| `paid_by` | uuid → profiles | Who fronted the money. |
| `description` | text | |
| `amount` | numeric(10,2) | Total bill. Always > 0. |
| `split_type` | text | `'equal'` \| `'exact'` \| `'itemized'` |
| `category` | text | Emoji e.g. `'🍽️'`. Auto-detected from description. |
| `tax` | numeric(10,2) | Itemized only. Distributed proportionally. Default 0. |
| `tip` | numeric(10,2) | Itemized only. Distributed proportionally. Default 0. |
| `expense_date` | date | When the expense happened (user-set). Default today. |
| `share_token` | text UNIQUE | `NULL` until user taps Share. Powers `/expense/:token` public page. |
| `deleted_at` | timestamptz | Soft delete. `NULL` = not deleted. |
| `created_at` | timestamptz | When recorded. Use for activity feed sorting. |
| `updated_at` | timestamptz | Set by trigger on every UPDATE. If `updated_at != created_at` → show "(edited)". |

**Trigger:** `expenses_updated_at` sets `updated_at = now()` on every UPDATE.

**RLS:** Group members only. Excludes soft-deleted rows (`deleted_at IS NULL`). Only `paid_by` can UPDATE.

---

### `expense_splits`
One row per person per expense. The source of truth for balance calculation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `expense_id` | uuid → expenses CASCADE | |
| `user_id` | uuid → profiles | |
| `owed_amount` | numeric(10,2) | Final amount owed by this person, including proportional tax/tip. |

**Equal split:** `amount / member_count`, remainder assigned to first person.
**Exact split:** User-entered amounts, must sum to `expense.amount`.
**Itemized split:** `subtotal + (subtotal / group_subtotal) × tax + (subtotal / group_subtotal) × tip`

**RLS:** Group members only.

---

### `expense_items` *(Phase 2 — schema included, not used in MVP)*
Line items for `split_type = 'itemized'`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `expense_id` | uuid → expenses CASCADE | |
| `name` | text | Item description. |
| `price` | numeric(10,2) | Always > 0. |

---

### `expense_item_assignments` *(Phase 2)*
Which members share each line item. Multiple assignees = price divided equally among them.

| Column | Type | Notes |
|---|---|---|
| `item_id` | uuid → expense_items CASCADE | PK |
| `user_id` | uuid → profiles CASCADE | PK |

---

### `settlements`
A recorded payment from one person to another within a group. Not tied to specific expenses — partial payments just stack.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `group_id` | uuid → groups CASCADE | |
| `from_user` | uuid → profiles | Who paid. |
| `to_user` | uuid → profiles | Who is owed. |
| `amount` | numeric(10,2) | Always > 0. |
| `note` | text | Optional. E.g. "via Venmo". |
| `settled_date` | date | When payment happened (user-set). Default today. |
| `created_at` | timestamptz | When recorded. Use for activity feed sorting. |
| `status` | text | `'pending'` or `'confirmed'`. Default `'pending'`. |

**Confirmation flow:**
- Created as `'pending'` — counts toward balance immediately.
- Payee confirms → `status = 'confirmed'`.
- Payee denies → DELETE the row (balance reverts).

**RLS:** Group members only. Both parties (`from_user` or `to_user`) can UPDATE status or DELETE.

---

### `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `recipient_id` | uuid → profiles | |
| `type` | text | See below. |
| `settlement_id` | uuid → settlements CASCADE | |
| `read` | boolean | Default false. |
| `created_at` | timestamptz | |

**Notification types:**

| Type | Recipient | Trigger |
|---|---|---|
| `settlement_confirm` | Payee (`to_user`) | Settlement created — "X says they paid you $N" |
| `settlement_confirmed` | Payer (`from_user`) | Payee confirms — "Y confirmed your payment ✓" |
| `settlement_denied` | Payer (`from_user`) | Payee denies — "Y denied your payment" |

**RLS:** Only recipient can SELECT or UPDATE (mark read). Any authenticated user can INSERT.

---

## Triggers & Functions

### `handle_new_user()`
Fires `AFTER INSERT ON auth.users`. Auto-creates a `profiles` row with `name`, `email`, `avatar_url` from Google OAuth metadata.

### `touch_updated_at()`
Fires `BEFORE UPDATE ON expenses`. Sets `updated_at = now()`.

---

## Indexes

| Index | Table | Column(s) | Condition |
|---|---|---|---|
| `idx_group_members_user` | group_members | user_id | |
| `idx_group_members_group` | group_members | group_id | |
| `idx_expenses_group` | expenses | group_id | `deleted_at IS NULL` |
| `idx_expense_splits_exp` | expense_splits | expense_id | |
| `idx_settlements_group` | settlements | group_id | |
| `idx_notifications_recip` | notifications | recipient_id | `read = false` |
| `idx_profiles_add_code` | profiles | add_code | |
| `idx_expenses_share_token` | expenses | share_token | `share_token IS NOT NULL` |

---

## Key Design Decisions

**Balances are computed, never stored.** Always calculate from `expense_splits` and `settlements`. Never cache a balance column.

**Expenses are soft-deleted** (`deleted_at timestamptz`). Everything else is hard-deleted.

**All monetary amounts are `numeric(10,2)`**, never `float`. Rounding: `Math.round(x * 100) / 100` in code.

**Split amounts must sum exactly to `expense.amount`.** Assign the rounding remainder to the first person in the list.

**`settled_date` vs `created_at` on settlements:** `settled_date` = when the payment happened (user-set, can be in the past). `created_at` = when it was recorded in Tally. Sort activity feeds by `created_at`.

**Member search** matches `name ILIKE`, `display_name ILIKE`, and `email ILIKE`. Return only `id`, `name`, `display_name`, `avatar_url` to the client — never `email`.

**`share_token` on expenses** is `NULL` by default. Generated only when the user explicitly taps Share. The `/expense/:token` page uses the Supabase service role key to bypass RLS — access is controlled by knowing the token.
