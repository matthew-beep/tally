# Notifications & group-membership lifecycle — design discussion (paused)

**Status: Tier 1 implemented 2026-07-29** (unconditional guest-conversion
decline, `on_group_member_updated` trigger wired, `notifications_type_check`
widened, dead `notify_group_invite_declined()` dropped, `INFO_TYPES` restored
in `me/page.tsx` — see migration `20260729000000_wire_group_invite_notifications.sql`).
Tier 3 (group-level "Jordan joined the group" activity feed item, instead of
a private notification to the inviter) was explicitly considered and
deferred — see "The tiered plan reached" below. Original discussion started
2026-07-27 while
investigating a real bug (accept/decline invite never notifies the
inviter — see `review-todo.md` Phase 2). The investigation opened into a
broader design question that isn't resolved yet. This doc captures where
that discussion landed so it doesn't have to be re-derived from scratch.
The accept/decline notification frontend hooks (`INFO_TYPES`/`infoLabel`
entries for `group_invite_accepted`/`group_invite_declined`) were removed
from `src/app/(dashboard)/me/page.tsx` as part of pausing this — see below.

## The bug that started this

`notify_group_invite_accepted()` and `notify_group_invite_declined()`
exist as Postgres functions, correctly written, fully granted — but no
trigger on `group_members` ever calls them. Verified directly against
`supabase/migrations/20260721000000_baseline_schema.sql`: the only
trigger on that table is `on_group_member_inserted` (fires the initial
`group_invite` notification). No `AFTER UPDATE`, no `AFTER DELETE`.
Also, `notifications_type_check` only allows 4 of the 6 documented
types — `group_invite_accepted`/`group_invite_declined` aren't in it,
so even wiring the triggers without widening the constraint would break
the accept/decline transaction itself, not just silently drop a
notification.

## Current, verified mechanics (all traced against live code)

- **Accept** (`useAcceptGroupInvite`): `UPDATE group_members SET status
  = 'active'` — `user_id` untouched, stays the same real profile id it
  always was.
- **Decline** (`/api/invite/decline`) — today branches on whether the
  invitee has any financial history:
  - No history → `DELETE FROM group_members`
  - Has history → `UPDATE ... SET user_id = null, status = 'active',
    invited_by = null` (converts the seat to a guest so existing
    `expense_splits` don't lose their FK target)
- **Guests** are always inserted directly as `status: 'active'`
  (`src/app/api/groups/members/add/route.ts`) — never `pending`. There's
  no accept step for a guest; nobody to ask.
- **`joined_at`** is set by `DEFAULT now()` at row *insert* time — for
  invite-link joins that's accurate (insert = active immediately); for
  search-invited members it's stale (invite-creation time, not
  acceptance time).
- **Guest claiming** (`profiles.claim_token`) is schema-present but
  explicitly unbuilt — `docs/schema.md`: *"flow not built yet"*. No live
  code path today moves a `group_members` row from `user_id = null` to
  `user_id = <real id>`.
- **Notifications never get deleted by app code** — every app-side touch
  of the `notifications` table is a `SELECT` or an `UPDATE ... SET read
  = true`, never a `DELETE`. The only removal path is cascade, via two
  `ON DELETE CASCADE` FKs: `group_id → groups.id` and `settlement_id →
  settlements.id`. Otherwise a notification row is permanent — marked
  read, invisible to `useNotifications()`'s `.eq('read', false)` filter,
  but never actually gone. No retention policy exists anywhere.
- **Where notifications are visible today:** only `/me`. The mobile tab
  bar has a badge *slot* (`WebNavBadge`) wired to the Me tab, but the
  data feeding it is a hardcoded empty object (`NAV_BADGES = {}` in
  `TabBar.tsx`) — plumbing exists, nothing populates it. Desktop sidebar
  has no notification indicator at all. Group page and home page have
  none either.
- **Notification lifespan on `/me` itself:**
  - Actionable (`group_invite`, `settlement_confirm`) — indefinite,
    until the user taps a button.
  - Informational (`INFO_TYPES`: `group_invite_accepted`,
    `group_invite_declined`, `settlement_confirmed`, `settlement_denied`)
    — auto-marked read the instant they render (a `useEffect` on `/me`),
    gone on the next refetch of `useNotifications()`. That refetch isn't
    only triggered by navigating away and back — the app's global
    `refetchOnWindowFocus: true` default means simply tabbing away and
    back while still on `/me` can also trigger it.
  - `settlement_confirmed`/`settlement_denied` are the two `INFO_TYPES`
    members that are actually live today — their triggers
    (`on_settlement_updated`, `on_settlement_deleted`) are wired and
    firing in production. `group_invite_accepted`/`group_invite_declined`
    were sitting in the same array, fully coded (labels included), never
    fed real data.

## The framework that emerged

Not "should this create an event," but **"does someone need to take
action, or just change what they know?"** Three buckets:

1. **Actionable** — requires a response. Notification card with buttons.
   (`group_invite`, `settlement_confirm`.)
2. **Informational** — changes what someone knows, no action needed.
   Two different UI treatments turned out to matter here:
   - *Quiet, one-person notification* — a buttonless card, auto-marks
     read, disappears after one viewing. (`settlement_confirmed`,
     `settlement_denied` today.)
   - *Group activity* — belongs in the shared feed everyone in the group
     sees, not a private ping to one person. (Expense added/edited/
     deleted, in principle — though editing already partially exists via
     the inline `(edited)` badge, and deletion is actively **excluded**
     from feed queries today per the soft-delete invariant, not shown.)
3. **Administrative** — nobody needs to know. Silent. (Invite link
   copied, notification marked read, banner dismissed — already how
   these behave today, nothing to change.)

Test for whether something belongs in shared activity at all: **if this
event were removed entirely, would anyone become confused?**

## The Case 1 / Case 2 distinction (identity vs. membership)

Two different questions get asked about the same `group_members` row,
and conflating them was the source of a lot of back-and-forth:

- **Case 1 — identity changed, membership didn't.** The seat was already
  part of the group's ledger; only *who's behind it* changed. Example:
  a guest claims an account (`user_id: null → <real id>`) — not built
  yet, but this is the shape it'll take. Nothing about the group's
  composition or balances changes. Per the framework: silent, no
  notification, no activity.
- **Case 2 — membership actually changed.** A genuinely new participant
  enters or leaves the group's ledger. Example: a search-invited person
  accepts (`pending → active`, `user_id` stays the same real id the
  whole time) — this is **always** Case 2 in the current schema, because
  Case 1's mirror (guest claiming) doesn't exist as a live path yet. Per
  the framework: this is activity ("Jordan joined the group"), not a
  private notification — everyone in the group should see it, not just
  the inviter.

The closest thing to Case 1 that *does* exist today runs the opposite
direction: decline-with-history converts a real invited person *into* a
guest (`user_id: <real id> → null`). By the same logic this is a
private, one-person-cares fact (the inviter), not something the whole
group needs to see — consistent with treating it as a quiet notification
rather than activity.

## The `status` column conflates two different lifecycles

`group_members.status` (`pending | active | left`) is asked to answer
two different questions depending on which population a row belongs to:

1. **Has this invite been responded to?** — meaningful only for real
   (`user_id`-having) members. Guests skip this entirely; they're
   inserted straight to `active`, no accept step, no one to ask.
2. **Is this seat currently in the group's ledger?** — meaningful for
   everyone, guests and real members alike.

Both populations share the *mechanical* meaning of `active` ("count this
row in balance/member queries"), but for a real member it also carries
the semantic weight "accepted an invitation" — which a guest never had
to do. This is why bolting a `declined` value onto the same enum felt
wrong: `declined` answers question 1, not question 2, and `status`
already conflates the two without a fourth value making it worse.

**Resolution reached:** don't add a 4th status value — and don't add
`declined_at` either. Revisited: the timestamp precision isn't worth it.
The informational notification (see below) plus the row simply being a
guest is signal enough that the invite was declined; nothing today needs
to mechanically distinguish "declined into a guest" from "intentionally
added as a guest." Same reasoning applied to `joined_at`'s staleness —
no consumer reads it this session, so it's left as-is (stale for
search-invite accepts, accurate for invite-link joins) rather than fixed
pre-emptively.

This still collapses the two decline code paths (delete vs.
convert-to-guest) into one: **always convert to guest, never
hard-delete**, regardless of financial history. The tradeoff — every
declined invite leaves a permanent placeholder guest row — is accepted
as worth it on its own, independent of any tracking column.

## The tiered plan reached (Tier 1 implemented 2026-07-29)

**Tier 1 — implemented.** Turned out to require one small migration after
all, not zero: `notify_group_invite_accepted()` already had both branches
written (`pending → active` for accept, `user_id: <id> → null` for
decline-via-guest-conversion) — it just had never been called by any
trigger. So closing this out was: restore **both** branches unmodified,
widen `notifications_type_check` back to all 6 types, wire
`on_group_member_updated` — i.e., almost exactly the migration that would
have closed the original bug, because it turns out the original design was
closer to correct than the intermediate detours suggested. `declined_at`
and the `joined_at` staleness fix stayed dropped — see "Resolution
reached" above; those were genuinely unneeded, unlike the trigger wiring.

Shipped in `supabase/migrations/20260729000000_wire_group_invite_notifications.sql`
plus:
- `/api/invite/decline` collapsed to one unconditional update — no more
  `hasHistory` branching (the `expense_splits`/`expenses`/`settlements`
  history lookups were removed entirely, they only existed to decide
  delete-vs-convert), no more `DELETE`, ever.
- `notify_group_invite_declined()` dropped — it was written for the old
  DELETE-based decline path, which no longer exists, so it was already
  inert before this change (see "The bug that started this") and is now
  gone rather than just unused.
- `INFO_TYPES`/`infoLabel` restored in `src/app/(dashboard)/me/page.tsx`
  for `group_invite_accepted`/`group_invite_declined` — same
  auto-disappearing treatment as `settlement_confirmed`/
  `settlement_denied`. Labels show the group name (`n.group?.name`) since
  the notification doesn't carry who accepted/declined, only which group.

**Tier 3 — deferred, not implemented.** Considered as an alternative to
the private notification for the *accept* side specifically (decline stays
private either way — see Case 1/Case 2 framework above). Not scoped in
detail, the more product-interesting piece:
"Jordan joined the group" / "Alex left the group" as real group activity
(not a notification to one person). Needs: `mergeFeed` (`lib/feed.ts`)
extended to pull a third source from `group_members` (today it only
merges `expenses` + `settlements`); a `left_at` column (doesn't exist —
`status = 'left'` has no timestamp to place it on a timeline); a
decision on whether admin-removal should read differently from
self-leave ("Alex left" vs. "Matt removed Alex" — same `status='left'`
transition today, no record of who initiated it); a new feed-item type
and rendering in `ActivityRow`/group detail's inline feed. This is
where the framework's most interesting idea lives, and it's the piece
that kept getting deferred at every decision point in this discussion.

## Open questions if this gets picked back up

1. ~~Does the inviter get *any* signal on decline?~~ **Settled:** yes,
   the existing `INFO_TYPES` auto-disappearing notification is enough —
   the notification plus the row now being a guest is sufficient signal,
   no extra tracking column needed to distinguish it from an
   intentionally-added guest.
2. Should accept behave the same way as decline, or does it actually
   want the bigger Tier 3 "member joined" activity treatment instead of
   (or in addition to) a private notification to the inviter?
3. `left_at` / admin-removal-vs-self-leave — still fully open, not
   touched by any of the above.
4. No retention policy exists for `notifications` (grows forever, no
   cleanup) — unrelated to this feature, noted while investigating, not
   urgent.
