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
- [x] **`DeleteGroupSheet` policy** — decided 2026-07-19: yes, group
  delete requires all balances at $0.00 (per original spec). **Reversed
  2026-07-29**: no balance guard — if the creator wants to delete the
  group, that's their call regardless of outstanding balances. Nothing
  was ever implemented under the original decision, so this is a pure
  no-op — current "creator can delete" RLS policy with no balance check
  is the intended final behavior, not a gap to close.
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
Status as of 2026-07-26: #1, #2, #3, #4, #5, #7, #8 all done; #6 done for
its cheap tier (the `<Money>` hero component stays deliberately deferred —
see #6 above). This list is fully closed out.

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
3. - [x] ~~**[consolidate] Three components hand-roll the sheet apparatus**~~
   — **fully resolved, 2026-07-26.** `GroupActionMenu` deleted entirely
   (see `TODO.md` § group settings entry point) — its trigger now routes
   straight to `/groups/[id]/settings`, no menu. `DeleteGroupSheet` and
   `ExpenseActionSheet` both migrated to `ModalOrSheet` — dropped their
   own `createPortal`/backdrop/escape-handler/slide-up animations
   entirely, picked up Vaul drag-to-dismiss on mobile and a real centered
   modal on desktop for free. Zero components in `src/` hand-roll sheet
   chrome anymore.
   `ExpenseActionSheet` (§19e, `TODO.md`) built from the "Desktop A —
   faithful port" direction explored in the `splitter` design project
   (`Expense Action Desktop.html`): same three screens (actions/edit/
   delete) stacked the way they read on mobile, just wider (~460px) and
   calmer, at a centered desktop modal instead of the mobile card
   stretched wide. Also picked up the `EmojiTile`/`SectionLabel`/
   `formatAmount` atoms from earlier in this session along the way.
   Deliberately did not adopt the design's fuller amount typography (sign
   + $ at half opacity / big number / mono cents) — that's the deferred
   `<Money>` hero component (#6 below), out of scope for a chrome-only
   migration.
   Typecheck + production build clean on both; neither exercised live in
   a browser yet (drag-to-dismiss feel, desktop modal sizing, the
   actions→edit→delete screen transitions within one open sheet).

   **Follow-up bug + fix, same day:** first pass on `ExpenseActionSheet`
   shipped with near-zero content padding on all three screens (one had a
   stray `'4px 4px 4px'`, two had none) — content sat flush against the
   sheet/modal edges on both mobile and desktop. Root cause: no shared
   default existed to fall back on, so the padding was typed from memory
   instead of a real source of truth. Investigating turned up
   `src/components/modal/ModalContent.tsx` (`padding: '20px 24px'`) plus
   `ModalHeader`/`ModalFooter` siblings, all exported from
   `components/modal/index.ts` — a complete, already-built content/header/
   footer composition for the modal system that **had zero consumers**
   anywhere in the app (`BalanceSheet`, `PersonProfileSheet`,
   `DeleteGroupSheet` all hand-roll their own ad-hoc padding divs too).
   Same "built but never adopted" shape as the dead `Btn.tsx`/
   `AmountDisplay.tsx` from the original consolidation audit.
   Fix scoped to `ExpenseActionSheet`: all three screens now use
   `<ModalContent>` for their padding. `ModalHeader`/`ModalFooter` were
   deliberately **not** adopted here — none of the three screens have a
   header shape that's just title-text-plus-close-X (they're rich identity
   blocks: emoji tile + description, a title-plus-Save-button row, an
   icon-plus-warning block), so forcing them in would mean redesigning the
   content, not just fixing padding. `BalanceSheet`/`PersonProfileSheet`/
   `DeleteGroupSheet` still don't use `ModalContent` — left as a known gap,
   not retrofitted in this pass.
   **Explicitly decided against:** a general spacing token scale
   (`T.space` or similar) across the whole app. That's a much bigger,
   deliberate design-system investment — CSS-in-JS here means it'd be a
   constants object, not utility classes, and to pay off it needs
   retrofitting into every padding/margin in the codebase, not just
   modals. `ModalContent` alone already fixes the actual failure mode
   (no default to fall back on for sheet/modal content specifically).
4. - [x] ~~**[style] `<SectionLabel>` atom**~~ — **done 2026-07-26.**
   `src/components/SectionLabel.tsx` — `size?: 'default'|'sm'` (11px/0.6 vs
   10px/0.7, the two real clusters found across the 39 prior uses),
   `color?` override for dynamic/danger-tone cases, `style?` passthrough for
   per-site margin/padding/flex. Migrated ~33 call sites across 12 files
   (group detail, group settings, settle page, home, me, onboarding,
   add/[add_code], invite/[token], groups/new, `AddExpenseForm`,
   `ExpenseActionSheet`, `PersonProfileSheet`, `BalanceSheet`, `Sidebar`),
   including three local near-duplicates of the same idea collapsed into
   it (`TILE_LABEL` in both `settle/page.tsx` and `AddExpenseForm.tsx`,
   `fieldLabel` in `ExpenseActionSheet.tsx`, `labelStyle` in
   `groups/new/page.tsx`, and the home page's own inline `SectionHeader`
   component now delegates to it). Odd stragglers (0.3/0.5/0.55/0.8/0.9
   letter-spacing, `'0.07em'`/`'0.08em'` string values) snapped onto the
   two canonical variants — that's the point of the atom. **Deliberately
   left alone**, because they're status pills/badges or per-row
   micro-captions, not section headers: the Organizer/Pending pill
   (`groups/new/page.tsx`), the "preview" tag (`onboarding/page.tsx`), the
   "You pay"/"You receive" chip (`settle/page.tsx`), and the "owes
   you"/"you owe" caption (`(dashboard)/page.tsx`). Typecheck + production
   build both clean.
5. - [x] ~~**[style] `firstName()` helper**~~ — **done 2026-07-26.** All 17
   remaining raw `.split(' ')[0]` call sites migrated to `firstName()` from
   `lib/memberDisplay.ts` (group detail, group settings, settle page,
   `ExpenseActionSheet`, `MemberCombobox`, `AddExpenseForm`,
   `PersonProfileSheet`, `BalanceSheet`, `SuggestedMembers`, `groups/new`,
   `add/[add_code]`). Files with a local `const firstName = ...` import the
   helper aliased as `getFirstName` to avoid self-shadowing. Typecheck
   clean. The only remaining `.split(' ')[0]` in `src/` are the helper's
   own implementation and `onboarding/page.tsx`'s handle-suggestion logic
   (correctly untouched — that's slug generation, not a display name).
6. - [x] ~~**[style] Money rendering — cheap tier done 2026-07-26.**~~
   `src/lib/money.ts` → `formatAmount(n, { sign? })` — plain `"$12.34"`, or
   with `sign: true` a `+`/`−` (U+2212) prefix, zero rendering plain with
   no sign either way. Migrated ~30 display call sites across 13 files
   (share page, group detail, group settings, settle page, `me`,
   `MemberActionSheet`, `ExpenseActionSheet`, `ActivityRow`,
   `BalanceSheet`, `AddExpenseForm`'s equal/percentage/exact/itemized
   builders). Caught one real bug in the migration: a group-detail "you
   owe / owes you" row derived its `+`/`−` from an external `youPaid`
   boolean rather than the value's own sign — `formatAmount(n, {sign:true})`
   trusts the number, so that site now passes a correctly-signed value in
   (`youPaid ? myAmt : -myAmt`) instead. **Deliberately left alone** (not
   in scope for this tier): form-input seed/dirty-check strings that need
   a bare `"12.34"` with no `$` (settle page, `ExpenseActionSheet`,
   `AddExpenseForm`'s exact-split defaults) — `formatAmount()` would
   corrupt those; and the hero-amount typographic split (separate `$`
   glyph + big whole number + small mono `.cents`, e.g. home page,
   `BalanceSheet`, `AddExpenseForm`'s itemized total input) — that's the
   `<Money>` anatomy component from the style guide, still deferred per
   `TODO.md`'s original note (rebuild once, migrate ~5-10 hero spots in
   one sweep, not opportunistically). Typecheck + production build clean.
7. - [x] ~~**[style] Expense row rendered 4 ways**~~ — **partially done,
   scoped down 2026-07-26.** As previously noted, the four renderings
   differ on purpose — only the emoji tile was actually identical.
   `src/components/EmojiTile.tsx` extracted and migrated into 3 of the 4
   (group feed, `ActivityRow`'s expense row, `ExpenseActionSheet` header —
   each kept its own size/radius/background, just deduplicated the
   box+center-flex markup). The public share page's emoji (`expense/
   [share_token]/page.tsx`) is a bare centered character with no
   background box at all — a genuinely different treatment, left as-is
   rather than forced into the atom. Typecheck + production build clean.
8. - [x] ~~**[consolidate] `Btn.tsx` (52) — zero importers**~~ — **confirmed
   deleted.** No `Btn.tsx` file and no importers anywhere in `src/`.

## Phase 1 — Schema & domain foundation

_(findings)_

## Phase 2 — Trust boundary

- [x] **[bug] Accept/decline invite never notifies the inviter.** Found
  2026-07-21 via the baseline schema dump (side effect, unrelated to the
  RLS work) — verified `notify_group_invite_accepted()` and
  `notify_group_invite_declined()` existed as functions with zero
  callers, live DB had only `on_group_member_inserted`. Investigating it
  opened into a broader design discussion (2026-07-27/28) before landing
  on a fix: whether accept/decline should notify at all vs. become silent
  `group_members` metadata, whether accepting should instead be "Jordan
  joined the group" group *activity* rather than a private notification,
  and a real conflation in what `group_members.status` means for guests
  vs. real members. Full writeup, verified mechanics, and the resolution:
  [notifications-and-membership-design.md](./notifications-and-membership-design.md).
  **Fixed 2026-07-29** — decline now always converts to guest (no more
  `hasHistory` branch, no `declined_at` column, no `DELETE` path);
  `notify_group_invite_accepted()`'s existing accept + decline-via-
  conversion branches wired via a new `on_group_member_updated` trigger
  (`notifications_type_check` widened to all 6 types, dead
  `notify_group_invite_declined()` dropped); `INFO_TYPES`/`infoLabel`
  restored in `me/page.tsx`. Migration
  `20260729000000_wire_group_invite_notifications.sql`, applied to
  remote. Group-level "member joined" activity (Tier 3) deferred, not
  implemented — private notification only for now.
  **Not yet retested live**: accept a search-invite end-to-end and
  decline one, confirm both notification cards render and auto-clear.

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
