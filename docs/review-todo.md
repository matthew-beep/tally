# Review findings — working notes

Companion to [review-checklist.md](./review-checklist.md) (the reading
order). Capture findings here as you review; keep `TODO.md` clean until a
finding is confirmed and worth scheduling. Suggested tags: **[bug]**
**[consolidate]** **[question]** **[style]** **[verified-ok]**.

When a phase is done, triage its findings: promote real items to `TODO.md`,
drop the rest, and note anything that changed your mind about existing plans.

---

## Decisions to make during the review (pre-seeded)

- [x] **RLS dashboard check** — recorded 2026-07-19 from live pg_tables /
  pg_policies. **RLS enabled on all public tables.** Policy summary and
  findings (severity-ranked):
  - **[bug][critical] `group_members` — no UPDATE policy.** Accept-invite
    (`useMembers.ts` client-side `update({status:'active'})`) silently
    matches 0 rows: notification marks read, membership stays pending,
    group never appears, accepted-trigger never fires. Invite-*link* path
    uses a server route, which is why this hid. Also blocks leave
    (`status='left'`). Fix: UPDATE policy `user_id = auth.uid()` (+
    consider restricting the transition).
  - **[bug][critical] `expense_splits` — no DELETE policy.** Expense edit
    (`useUpdateExpense` delete-then-reinsert) silently keeps old splits and
    inserts new ones (no unique on expense_id+member) → balances
    double-count on every edit. Run the dupe + split-sum checks; clean up
    any corruption. Fix: DELETE (and UPDATE) policy scoped like INSERT.
  - **[security][high] `profiles` SELECT = `status='active'` only** — no
    role/auth restriction: anon key can dump all profiles **including
    email** (+ add_code). Violates "email never shown to other users".
    Fix: column-level grants or public view without email.
  - **[security][med] `notifications` INSERT (any authed)** — triggers are
    SECURITY DEFINER and need no policy; this only enables forged
    notifications to arbitrary recipients. Drop it.
  - **[security][med] `group_members` INSERT (any authed, any row)** —
    self-join to any group by UUID, spam-adds, forged invited_by. Join +
    search-add now go through server routes → tighten or drop.
  - **[integrity][med] `group_members` DELETE `user_id = auth.uid()`** —
    "leave" per spec is UPDATE to 'left'; a real DELETE cascades into
    expense_splits and corrupts history. Remove/replace once UPDATE
    policy exists.
  - **[integrity][low] `settlements` UPDATE allows either party** — payer
    can self-confirm; restrict confirm to `to_member_id`.
  - **[integrity][low] `groups` INSERT** doesn't pin
    `created_by = auth.uid()`; expenses UPDATE permits re-parenting
    between my own groups.
  - **[ok]** expenses soft-delete-only (no DELETE policy) correct;
    expense_history SELECT-only correct (trigger writes);
    `expense_items`/`assignments` lack UPDATE/DELETE — revisit with
    itemized (Phase 2).
  - **[security][high] `get_my_group_ids()` has NO status filter**
    (verified 2026-07-19: SECURITY DEFINER ✓, pinned search_path ✓, but
    `WHERE user_id = auth.uid()` only) — **pending and left members have
    full read access** to group data. Fix needs two parts: add
    `AND status = 'active'` to the fn, **plus** a narrow `groups` SELECT
    policy for pending invitees (invite notifications show the group name
    via this leak today — filter alone breaks invite previews).
  - **[confirmed] Edit-corruption exists in prod**: expense `18cd87f6…`
    has 2× splits for all 3 members. Absent from the live split-sum check
    → expense is (almost certainly) soft-deleted, so live balances are
    clean. Migration `20260719000000_rls_critical_fixes.sql` adds the two
    missing policies, dedupes (guarded: aborts if LIVE dupes exist), adds
    UNIQUE (expense_id, group_member_id), drops the notifications INSERT
    policy. **Applied + verified 2026-07-19** (policies present, dupes
    gone, constraint in place — via SQL editor, so run
    `supabase migration repair --status applied 20260719000000` before
    any future `db push`). App-level retest still pending: accept an
    invite end-to-end, edit an expense.
  - **[followup] Done 2026-07-19, migration `20260719120000_rls_followup_tightenings.sql`
    (commit `605bf24`).** `get_my_group_ids()` now filters `status = 'active'`
    (+ own-row and pending-preview SELECT policies so decline/invite
    notifications still resolve), `group_members` INSERT is self-only,
    client-side `group_members` DELETE dropped (cascade hazard), settlement
    confirm restricted to the payee. Shipped as a unit with the route
    hardening below — routes deployed first, migration applied after.
    Baseline migration itself landed 2026-07-21 (`482424b`, squashed to one
    replayable schema dump — local `db reset`/`db pull --linked` now agree
    with prod, zero drift).
- [x] ~~`AddMemberModal.tsx` / `BalanceBreakdownModal.tsx` fate~~ —
  resolved 2026-07-13: all dead code deleted (recoverable from git).
- [x] **`DeleteGroupSheet` policy** — decided 2026-07-19: **yes, group
  delete requires all balances at $0.00** (per original spec). Not yet
  implemented. Two layers needed: client check in `DeleteGroupSheet`
  (disable + explain when any member's net ≠ 0), and a DB guard —
  the delete runs client-side under the "creator can delete" RLS policy,
  so a UI-only check is bypassable; enforce with a trigger or move the
  delete behind an API route that verifies balances first.
- [x] ~~**Shared balance core**~~ — built 2026-07-18 as designed.
  `calcPairwiseNets` + `summarizeBalances` in `lib/balance.ts` with the
  consistency invariant test — which caught a real settlement-direction
  bug on the first implementation attempt (third-party settlements
  debiting my pairwise). Group page swapped to the lib calls; hero
  grosses now come from `summarizeBalances` (the `Math.max(0)` floors are
  gone — hero equals the sum of person rows; edge-case numbers shifted,
  which is the fix). **Still open: eyeball both screens' numbers in dev
  before the next release.**
- [ ] **Desktop verification** — fill in the blanked Desktop cells in
  [feature-status.md](./feature-status.md) as each screen is exercised.
- [x] **Invite links deferred** — decided 2026-07-19: no UI exposes the
  invite link yet, and the flow is (almost certainly) broken for
  brand-new invitees anyway — the page resolves the token via a
  client-side `groups` query, but the SELECT policies are
  membership-based, so a membership-less user gets "Invite not found"
  (see Phase 2 API-route read). Deferred with the whole token flow in
  favor of core functionality (group settings, settling). When picked
  back up: token resolution needs a `SECURITY DEFINER` `resolve_invite(token)`
  returning only `(id, name, emoji)` (or a service-role route) — a
  permissive `groups` read policy is NOT an option (would leak
  `invite_token` columns → join-anything). The tightened self-only
  `group_members` INSERT policy already permits the future link-join.
- [x] ~~**Per-group caches as the canonical data layer**~~ — adopted and
  built 2026-07-18 (proposed 2026-07-14). As-built description now lives
  in [data-loading-architecture.md](./data-loading-architecture.md)
  (rewritten; it supersedes that doc's earlier proposal). What landed:
  `groupsQueryOptions` root (`['groups']`; `useMyGroupIds` is a `select`
  view over it, not a query), `useAllGroupData` fan-out sharing the
  single-group hooks' query options, `useGlobalBalances` + `useAllActivity`
  rewritten as pure derivations (no cache keys of their own, pages
  untouched), invalidation lists pruned to per-group keys only. Build
  notes: dead `useRecentActivity` + `RecentExpense` deleted (zero
  consumers); unused `GlobalBalances` fields (`transfers`, gross-by-person
  maps) dropped; `useActivity`'s hand-rolled display-name fallback replaced
  with `lib/memberDisplay`. Known constraint recorded in the arch doc:
  canonical caches can never be paginated while balance math is
  client-side; server-side RPC + paginated feed query are the escape
  hatches.

## Consolidation pass 2 (2026-07-13, pre-review sweep)

Follow-up to the first duplication audit (balance math ×3, avatar slots ×8,
display-name fallback, invalidation lists — all in TODO → Consolidation).
Ranked: #1–2 are the high-value items; #3 pairs with planned work; #4–7
are batch-someday polish; #8 is a ten-second delete.

1. - [x] ~~**[consolidate][bug] `postJson` helper**~~ — done 2026-07-19:
   `src/lib/api.ts` → `postJson(path, body)`, always throws the server's
   `{ error }` (fallback `Request failed (status)`), defensive JSON parse.
   All five call sites migrated. The two sites with no error UI got it:
   invite decline (was a **silent swallow** — now shows the message) and
   `add/[add_code]` (was a generic throw that escaped as an unhandled
   rejection — now caught + rendered). Rate-limit 429 text now surfaces
   everywhere. Future routes inherit correct behavior.
2. - [x] ~~**[consolidate] Feed merge ×2**~~ — done 2026-07-18:
   `mergeFeed` in `lib/feed.ts` (tested), both consumers shape from it.
   Contract decision: sort is `created_at` only; `expense_date` is
   bucketing metadata (backdated expenses surface at the top). Still the
   seam where feed pagination lands later.
3. - [ ] **[consolidate] Three components hand-roll the sheet apparatus** —
   `DeleteGroupSheet`, `GroupActionMenu`, `ExpenseActionSheet` each do
   their own `createPortal` + overlay + Escape handler +
   `document.body.style.overflow` lock while `components/modal/` already
   ships `Modal`, `ActionSheet`, `ModalOverlay`, `useBodyScrollLock`
   (4 inline scroll-locks, 4 esc-handlers outside the system). Bundle with
   the planned 19e Vaul conversion — don't do separately.
4. - [ ] **[style] `<SectionLabel>` atom** — the uppercase/letter-spaced
   muted header style is copy-pasted ~35×.
5. - [ ] **[style] `firstName()` helper** — `.split(' ')[0]` ×21; add next
   to `displayName()` in `lib/memberDisplay.ts`, same PR as the
   ProfileSnippet overload (TODO → Consolidation).
6. - [ ] **[style] Money rendering** — sign-color ternary (mint/coral) ×10
   + inline `toFixed(2)` ~×40 re-answer what the deleted `AmountDisplay`
   was for. A minimal `formatAmount()` / `<Money>` atom absorbs ~50 sites
   whenever consistent money anatomy is wanted.
7. - [ ] **[style] Expense row rendered 4 ways** — group feed, `ActivityRow`,
   `ExpenseActionSheet` header, share page each build emoji-tile +
   description + meta + amount. Designs differ per context on purpose;
   the emoji tile itself is identical in all four.
8. - [ ] **[consolidate] `Btn.tsx` (52) — zero importers**, missed in the
   dead-code purge (grep matched its own filename). Same situation as
   `AmountDisplay`: unadopted atom, every real button is inline-styled.
   Delete (or adopt).

## Phase 1 — Schema & domain foundation

_(findings)_

## Phase 2 — Trust boundary

- [ ] **[bug] Accept/decline invite never notifies the inviter.** Found
  2026-07-21 via the baseline schema dump (side effect, unrelated to the
  RLS work). `notify_group_invite_accepted()` and
  `notify_group_invite_declined()` exist as functions but **no trigger
  calls either** — live DB has only `AFTER INSERT ON group_members`
  (the initial invite), no `AFTER UPDATE`/`AFTER DELETE`.
  `20260711000000_decline_to_guest.sql` only ever replaced the function
  body; it never contained the `CREATE TRIGGER`, silently assuming one
  existed from the dashboard baseline — it didn't. **Also**: even with the
  trigger wired, `notifications_type_check` only permits 4 of the 6
  documented types (missing `group_invite_accepted`/`group_invite_declined`)
  — fire the trigger without widening the constraint and the accept/decline
  UPDATE itself starts failing. Fix is two-part, must ship together:
  widen the CHECK constraint, then add
  `CREATE TRIGGER on_group_member_updated AFTER UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION notify_group_invite_accepted()`. Today's
  seat updates work fine — this is silent-notification-loss only, not
  data corruption.

API-route read 2026-07-19 (all three routes + supabase-server.ts; answers
the checklist's three pre-flagged questions):

- [x] ~~**[bug][med] `groups/create` — worse than flagged.**~~ — **Fixed
  2026-07-19, commit `605bf24`.** Creator's membership row is now inserted
  separately, first; on failure the group is rolled back (deleted) instead
  of left orphaned. Invitee insert is a separate batch after, failures
  reported via `membersError` in the response instead of swallowed.
- [x] ~~**[security][med-high] `members/add` — no caller-membership
  check.**~~ — **Fixed 2026-07-19, commit `605bf24`.** Route now checks
  the caller has an `active` `group_members` row (via service-role client)
  before any write, returns 403 otherwise. Guest inserts carry
  `invited_by` too, closing the rate-limiter bypass.
- [x] **Checklist Q "can upsert demote active → pending?" — no, by
  accident.** The upsert *code* would demote and overwrite `name`, but
  ON CONFLICT DO UPDATE must pass the UPDATE policy for the existing row,
  and `group_members` UPDATE is self-only (was: absent) → conflict path
  errors instead. Consequence: **re-inviting an existing pending member
  errors** rather than no-oping. **Fix shipped 2026-07-19 (`605bf24`):
  `ignoreDuplicates: true` on the upsert — re-invite is now a clean no-op.**
- [x] **`invite/decline` scope — clean.** Verifies the caller's own
  *pending* membership via the session client before any service-role
  write; admin writes are keyed to that verified seat id. Depended on
  `get_my_group_ids()` NOT filtering status so a pending member could
  SELECT their own row — **resolved 2026-07-19 (`605bf24`)**: the
  status-filter migration shipped together with an own-row SELECT policy
  and a pending-preview policy, so decline and the invite page's
  membership check both still resolve correctly.
- [x] ~~**[confirmed] `getSession()` in all three routes**~~ (appendix
  item) — **Fixed 2026-07-19, commit `605bf24`.** All three routes
  (`groups/create`, `members/add`, `invite/decline`) call
  `supabase.auth.getUser()`.

- [x] **[bug] Query cache survived auth changes** — found live 2026-07-19
  (test-account sign-in greeted as previous user). `signOut()` never
  touched the QueryClient and no query keys include a user id, so account
  B was served account A's cached profile/groups/balances — with
  `staleTime: 60s`, potentially *without any refetch*, until staleness or
  refocus. Fixed same day: auth boundary = cache boundary —
  `onAuthStateChange` listener in `providers.tsx` clears the cache
  whenever the session's user id changes (id comparison, not event names —
  SIGNED_IN fires on token refresh too; `undefined` sentinel avoids
  clearing on initial observation), plus a redundant `qc.clear()` in the
  explicit `signOut()` path. Known cosmetic quirk: clearing while the
  dashboard is mounted triggers momentary refetches as a signed-out user
  before the redirect unmounts them — harmless, discarded.

## Phase 3 — Entry & auth-adjacent pages

_(findings)_

## Phase 4 — Core UI: the money screens

- [x] **[bug] Pending members rendered identically to active** — found live
  2026-07-19 (created group + search-invited someone; no pending signal
  anywhere). Data layer was correct (RPC inserts `status: 'pending'`,
  trigger notifies); all three member renderings on group detail just
  ignored `m.status`. Spec calls for a ⏳ badge; extra weight because
  pending members are deliberately splittable (as-built drift, see
  group-member-model.md) — organiser could split with a non-consenting
  invitee with zero indication. Fixed same day: "⏳ invited" pill in the
  desktop members column (styled to match BalanceBadge's settled pill —
  extract a Pill atom on third use), dimmed avatars in the mobile strip,
  ⏳ in the empty-state preview.

## Phase 5 — Dashboard shell & remaining screens

_(findings)_

## Phase 6 — Modal system, atoms, CSS

_(findings)_
