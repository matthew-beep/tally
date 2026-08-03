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
  delete requires all balances at $0.00 (per original spec). **Corrected
  2026-07-29**: this was already implemented, contrary to the original
  note here — `src/components/DeleteGroupSheet.tsx` computes
  `calcNetBalances` over active members and gates the confirm input/CTA
  (`canDelete = unsettledCount === 0`) with a "Settle all balances before
  deleting" message. Only a client-side check, no DB-side guard (the
  delete still runs under the plain "creator can delete" RLS policy) —
  bypassable by a crafted request, but accepted as fine since deletion
  requires being the creator either way, not a spoofable third party.
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

---

# Code-quality pass — `AddExpenseForm` + cross-cutting (2026-08-02)

Unplanned pass, not part of the Phase 1–6 reading order. Brief was "check for
issues, optimizations, places to consolidate — the add expense form is very
large so maybe start there." Baseline was green (typecheck clean, 47 tests) and
still is (50 tests). Scope ended up being the `AddExpenseForm` decomposition
plus the money-math and duplication findings that fell out of reading it.

Several findings here were **already logged** in `TODO.md` — those are
reconciled under "Against existing TODO items" rather than re-reported.

## Landed

### [bug] Split rounding remainder went to row 0, not the payer

`lib/splits.ts`. `makeEqualSplits` hardcoded `i === 0` and `makePercentSplits`
hardcoded `splits[0]` for the leftover cent. Both are called from
`AddExpenseForm` with a member array whose order comes from `Set` iteration and
query order, so the cent landed on an arbitrary member. The split-sum invariant
held (the money always added up) but `CLAUDE.md`'s "rounding remainder is
assigned to `paid_by`" did not. `rescaleSplits` already did this correctly — the
two builders had just never been brought in line.

Fixed by extracting the `absorbRemainder` helper all three now share, plus an
optional `payerId` param (falls back to row 0 when absent, so any caller without
payer context is unchanged). Three tests added. Worth stating plainly: the bug
was **at most one cent per expense** — logged for correctness, not urgency.

### [bug] Desktop remainder counter disagreed with `canSave`

`DesktopSplitList` summed percentages/amounts over `memberIds` (every group
member); the parent computed validity over `included`. Deselect someone in Equal
mode, switch to Percent, and the footer pill could read "Adds up to 100%" while
the Save button stayed disabled, with nothing on screen explaining why. Both now
read one value off the hook.

### [bug] Percent/exact seeding — two failure modes, both blocking Save

1. The even-split pre-fill ran on `[splitMode]` only. Switch to Exact *before*
   typing the amount (easy on desktop — the mode tabs sit right of the amount
   field) and every row kept the old total's share forever. Save was
   permanently blocked and no single field looked wrong.
2. The seed used `(100/n).toFixed(1)` and `(amt/n).toFixed(2)` per row, so any
   3-way split opened at 33.3 + 33.3 + 33.3 = 99.9% — invalid on arrival.

Both fixed by `evenShares()` (distributes the leftover the same way
`absorbRemainder` does) plus re-seeding on amount/member change until the user
edits a field, tracked by `percentTouched` / `exactTouched`.

### [consolidate] `AddExpenseForm` 1193 to 56 lines

Now `src/components/add-expense/`: `useAddExpenseForm.ts` (346, all state, math
and save), `DesktopPanel.tsx` (370), `MobilePanel.tsx` (432), `parts.tsx` (67,
shared atoms), `types.ts` (21). Total is roughly flat — this was decomposition,
not deletion.

The load-bearing part is that the mobile/desktop split-semantics difference is
now stated **once**, as `amountsIds` in the hook:

- Mobile — every member except the payer owns an input; the payer's share is
  the remainder.
- Desktop — every member including the payer owns an input; the whole list must
  balance.

Everything downstream (remainder pill, `canSave`, the saved splits) reads from
it, which is what makes the two bugs above structurally hard to reintroduce.
Previously that rule was restated in four places, two of them disagreeing.

Also dropped while moving: `PaidByChips`' `compact` and `memberById` props (only
ever called without them), `SaveFooter`'s `showStatus` (always `true`), and the
`TaxTipRow` interface (inferrable).

### [consolidate] `slotFor` x4, `stripNegative` x3

`slotFor` moved to `lib/memberDisplay.ts`; `stripNegative` to `lib/money.ts`,
joined by `round2()` and `parseNum()`. Call sites updated in group detail, group
settings, settle page, `ExpenseActionSheet`, `SettleUpSheet`. This is the
index-based half of the avatar-slot item in `TODO.md` — see reconciliation below.

### [style] Dead block in the home hero

`(dashboard)/page.tsx` — a `{false && (...)}` stats grid containing a literal
`test` string, plus the `stats` array feeding only it. Deleted. Only that block
was touched; the rest of that file's working-copy changes are Matthew's.

## New findings — not previously logged

### [question] Two different debt models behind one "Settle up"

**This interacts with the settle-up rework at the top of `TODO.md` and should be
decided before that work starts.**

- Group detail, via `SettleUpSheet`, builds `Transfer[]` from
  `calcPairwiseNets` — you settle with people you actually transacted with.
- `BalanceSheet.tsx:151` navigates to `/groups/[id]/settle`, which uses
  `simplifyDebts(calcNetBalances(...))` — greedy min-transfer, which can name a
  counterparty you have never split anything with.

Same button label, same group, different answers depending on entry point. The
planned rework converts `/settle` into a thin wrapper around the sheet, which
would silently resolve this in favour of pairwise — worth doing **deliberately**
rather than as a side effect, because `simplifyDebts` is tested, is documented
in `CLAUDE.md` as the debt-simplification strategy, and would then have no
production caller.

### [bug] Mobile renders the desktop panel for one frame

`hooks/useMediaQuery.ts` — `useMediaQuery` initialises `matches` to `false` and
corrects in an effect, so every `ModalOrSheet` consumer paints its desktop
branch first on mobile. Most visible on `AddExpenseForm` (two-column modal into
mobile sheet). Fix is a lazy `useState` initialiser guarded for SSR, or
`useSyncExternalStore` with a server snapshot.

### [bug] `useAllGroupData`'s `useMemo` consumers never hit

`useAllGroupData` builds three fresh record objects unconditionally every render
and returns a new object literal. Both `useGlobalBalances:108` and
`useAllActivity` list `all` in their `useMemo` deps — so the dependency changes
identity every render and the memo never hits. All cross-group balance and
activity math re-runs on every parent render of the dashboard.

Wrapping `useAllGroupData`'s return in a `useMemo` keyed on the underlying query
data would make both memos effective. Cheap fix, unmeasured benefit — the folds
are O(expenses) and probably fine at current scale, so treat this as "make the
code do what it already claims" rather than a known-hot path.

### [consolidate] Dashboard fires 3N queries

`useAllGroupData` fans out `expenses` + `settlements` + `members` per group. Ten
groups is 30 requests on home mount. The cache-sharing design is deliberate and
good (documented in `data-loading-architecture.md`; navigating group to
dashboard is warm) — the cost is purely the initial fan-out. Three batched
`.in('group_id', ids)` queries partitioned into the same per-group keys via
`setQueryData` would preserve every property the arch doc relies on and take 3N
to 3. Not urgent at current group counts; noting it as the natural next step if
the dashboard ever feels slow.

### [style] `calcNetBalances` vs `calcPairwiseNets` filter soft-deletes differently

`lib/balance.ts:12` uses `!e.deleted_at`; `:81` uses `e.deleted_at === null`.
Equivalent for rows off the wire, divergent for any partial or constructed row
where the field is `undefined`. The soft-delete invariant is load-bearing enough
that one shared predicate is worth it.

### [style] `makeExactSplits` doesn't enforce the split-sum invariant

The other two builders now guarantee it via `absorbRemainder`; exact just rounds
each row and trusts the caller. The UI validates before calling, so this is not
live — but `lib/splits.ts` is where `CLAUDE.md` says the invariant is enforced,
and exact is the one path that does not. Either run it through `absorbRemainder`
too (needs the total passed in) or note the asymmetry in the file.

### [style] `/groups/[id]/add/page.tsx` is a 15-line redirect stub

`router.replace` to the group page, dropping the user's intent. Either delete it
or make it deep-link into the open sheet (`?add=1`). Interacts with the settle
rework, which is keeping `/settle` addressable for exactly that linkability
reason — the two routes should end up consistent.

## Against existing TODO items

- **"Global mutation error surface"** (`TODO.md`, Prod readiness) — confirmed
  and now enumerated. Eight unguarded `mutateAsync` sites: `groups/new:150`,
  `settle/page:49`, `me:50`, `useAddExpenseForm:298`, `DeleteGroupSheet:128`,
  `ExpenseActionSheet:56` and `:247`, `SettleUpSheet:185`. Zero `onError`
  anywhere. The failure mode on the money screens is the bad one: the promise
  rejects unhandled, `onSuccess()` never fires, the sheet sits on "Saving...",
  and the user cannot tell whether the expense was recorded. **Highest
  user-impact item found in this pass** — the logged `MutationCache.onError` +
  `error.tsx` approach is right, it just deserves to move up the list.
- **"Avatar slot color x8, two conventions"** (`TODO.md`) — half done. The
  index-based `slotFor` is now exported once from `lib/memberDisplay.ts` and its
  3 copies are deleted. The 5 `hashSlot(id)` copies are untouched, so the
  same-person-different-colour symptom persists between home and group screens.
  Remaining work is unchanged: migrate the 5 hash sites to index-based.
- **"Unread count badge on nav bell"** (`TODO.md` section 4) — still unbuilt, and
  `useProfile.ts:121-122` carries a comment asserting the badge "uses
  `refetchInterval: 30_000` in its own query (not defined here)". No
  `refetchInterval` exists anywhere in `src/`. The comment reads as a
  description of shipped behaviour; it should say "will use" until that lands.
- **Optimistic updates** — `CLAUDE.md` documents the `onMutate`/rollback pattern
  in detail. There is zero `onMutate` in the codebase; every mutation is
  insert, invalidate, refetch. Not logged anywhere as a gap. Either build it for
  `useAddExpense` and `useCreateSettlement` (the hot paths) or amend
  `CLAUDE.md` — the doc currently overstates what is built.
- **`groups/new/page.tsx` (816)** is now the largest file, having overtaken
  `AddExpenseForm`. Same shape as the problem just fixed: one function holding
  form state, member search, guest handling and both layouts, with only
  `MemberRow` and `Chevron` extracted. Natural next target for the same
  treatment (`useCreateGroupForm` + `MemberPicker` + panels).

## Suggested order

1. **Mutation error surface** — highest user impact, already specced in `TODO.md`
2. **Settle-up debt-model decision** — shapes the planned settle rework
3. `useMediaQuery` first-frame flash and the `balance.ts` predicate — both quick
4. `groups/new` decomposition
5. Batched fan-out — before group counts grow
