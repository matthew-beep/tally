# Publish roadmap

_Written 2026-08-03 from a verified pass over `TODO.md` and `src/`. Every claim
below was checked against code or migrations at that date — where this contradicts
an older note, this is newer. Sequencing detail for each item lives in `TODO.md`;
this doc is the critical path and the sizing, not a replacement for it._

**Definition of "publish":** a stranger can sign in, create a group, get their
friends into it, log expenses, settle up, and have the other person see and
confirm it. Nothing user-reachable is a dead end.

**Estimate basis:** hours of focused Matthew + Claude session time, not
calendar. 🟢 items Claude can run solo; 🟡 needs a decision from you first, and
that decision is usually the long pole, not the code. Estimates exclude the
decision time.

---

## Where the build actually is

Stronger than the punch list implies. Auth, onboarding, groups, members,
expenses (equal/exact/percentage with a tested split-sum invariant), balances,
activity, the settle sheet, notifications-on-home, and RLS across every table
are all built and working. The gaps are narrow and specific.

Three things block a launch. Everything else is polish or post-v1.

---

## P0 — blocks any real user

### 1. Settlement notification semantics 🟢 · **~45m left** (was 2–3h)

**DB half shipped 2026-08-05.** `20260805000000_settlement_notification_direction.sql`
is applied to the linked project: `notifications_type_check` widened with
`settlement_recorded`, and `notify_settlement_created` now branches on
`NEW.status` — `pending` → `settlement_confirm` to the payee, `confirmed` →
`settlement_recorded` to the payer.

**The decision this item was waiting on is made:** yes, a payee-recorded
payment skips the pending state. Claiming someone paid you *costs* you — it
erases money owed to you — so there is nobody to protect. Balance semantics are
untouched, because the invariant counts `status IN ('pending','confirmed')`,
i.e. all of them; confirmation has never moved a number.

**`settlements.recorded_by` is not needed** — the earlier plan for it predates
the batch model. Status itself carries who recorded it, and is uniform across
every row of one payment. No column, no backfill.

Remaining, all client-side and mechanical — until it lands the migration is
inert, since `useCreateSettlement` (`useSettlements.ts:43`) still inserts
`pending` unconditionally and every row takes the old branch:

- `useCreateSettlement`: insert `confirmed` when the creditor is recording;
  `SettleUpSheet.handleConfirm` already has `direction` in scope to pass.
- `src/types/index.ts:88` — add the new type to the `Notification` union.
- `me/page.tsx` — `INFO_TYPES`, `infoLabel()`, and the amount line at `:217`.

Step-by-step in `TODO.md` item 5, phase 1.

**Still do this before item 2** — it writes settlements, and building that
against the old semantics means migrating rows later.

### 2. Dashboard settle writes 🟢 · **2–3h**

`BalanceSheet.tsx:156` and `:289` are `onClick={() => {}}`. The hard part is
already done: `PersonPart` carries `groupMemberId` + `mySeatId` and
`resolveSeatId()` exists, so both handlers are "call `useCreateSettlement` with
data already in scope."

- Per-group screen: one insert.
- Settle-all: one insert per group in `parts`.
- Both need error and pending states — `MutationCache.onError` already catches
  failures globally, so this is mostly disabling the button while in flight.

Note the sub-cent residue caveat recorded under `TODO.md` item 5:
`PersonEntry.net` sums all per-group entries while `parts` filters at `>= 0.01`,
so settle-all can leave a fraction of a cent behind and not strictly zero the
person out. Invisible in dollars, but decide whether to derive `net` from the
filtered parts before shipping the write.

### 3. Invite path — the real blocker ✅ **done 2026-08-11**

**Fixed.** The failure mode described below was real; the fix taken differs
from what this section originally proposed — worth noting for anyone
following the estimate.

- `invite_token` appeared in exactly two places in `src/`: the route that
  read it, and the type. No screen generated or showed a link — fixed by
  `InviteGroupSheet.tsx`, opened from a new "Invite to group" row in group
  settings (link card, copy, `navigator.share`).
- The route was broken for the people it exists for. The `groups` SELECT
  policy (baseline `:762`, `:766`) allows members, the creator, or *pending
  invitees* — a stranger holding a link matched none of those, so the lookup
  returned nothing and they saw "invalid".
- Member search only found existing users. Guests could be added, but
  claiming had no route or UI — now built, both a self-serve claim link and
  an assisted, confirmation-required invite path. See `docs/flows.md` §
  Claim a guest seat.

**What actually shipped, vs. the `POST /api/invite/resolve` service-role
route this section originally proposed:** the lookup went through
`get_group_by_invite_token()`, a `SECURITY DEFINER` SQL function
(`20260811000000_get_group_by_invite_token.sql`), not a Next.js API route.
Same non-negotiable — a permissive `groups` read policy was never an option,
it would leak `invite_token` and let anyone join anything — but the RPC
approach mirrors the existing `get_my_group_ids()` precedent already in the
schema, needs no server-only secret, and is callable directly from the
already-client-side `/invite/[token]` page via `supabase.rpc(...)`. The
claim flow's preview (`get_seat_by_claim_token`) and self-serve claim write
(`claim_seat`) both follow the same RPC pattern; only the assisted claim
path (Path B, privileged write on someone else's row) uses a service-role
API route, matching `/api/groups/members/add`'s existing shape.

**P0 total:** this item is done; re-total against the remaining P0 items
before treating the original 8–12h estimate as current.

---

## P1 — before handing it to anyone who isn't you

### 4. CI 🟢 · **1h**
No `.github/workflows` at all. Typecheck + test + build on push. Also catches
the stale-`.next` failure: a warm cache from before the `/settle` deletion fails
typecheck on a route that no longer exists (`rm -rf .next` clears it locally).

### 5. `import 'server-only'` in `lib/supabase-server.ts` 🟢 · **15m**
Build-time guard so the service-role module can never be pulled into a client
bundle. Cheap insurance that gets more valuable the moment the app is public.

### 6. Mobile presentation pass 🟡 · **2–4h**
`TODO.md` item 8 — settle drawer sizing, app background not covering the
viewport, header/footer hairlines. Needs a real device, which is why it can't be
run solo. First launch impressions are mostly this.

### 7. Responsive design pass + QA sweep 🟡 · **5–8h**

Process and matrix: [responsive-qa.md](./responsive-qa.md). Two parts.

**a. Close the mixed-zone gap — 1–3h.** `useIsMobileSheet()` switches at
`max-width: 767px`; the layout CSS switches at `max-width: 1023px`
(`dashboard.css:10`, `:191`, `:383`). Across 768–1023px — iPad portrait, small
laptop windows, split screen — you get mobile nav and mobile page layouts with
**desktop modals**: `AddExpenseForm` renders its two-column `DesktopPanel`
inside a centered modal over a single-column mobile page with a tab bar. Never
designed, never verified.

Cheap fix is moving the JS breakpoint to `1023px` so sheet presentation follows
the nav chrome — one line, then re-verify every sheet. The alternative is
committing to the mixed state and designing for it, which is not a v1 job.
**Decision needed.**

**b. First full QA sweep — 3–5h.** Run the matrix: ~14 features × 3 zones, light
and dark, at least one real device. Budget the high end for a first run, since
it doubles as bug discovery — `feature-status.md` has blank Mobile/Desktop cells
that are blank because nobody checked, not because anything is known broken.
Record results back into that table.

Two known failures will surface immediately and are already tracked as `TODO.md`
item 8: settle-drawer height instability, and the app background not covering
the viewport once mobile browser chrome collapses. Fixing those is item 8's
2–4h, not counted here.

**Not included:** the *designed* desktop treatments — home 3-column dashboard,
group settings' desktop layout (`TODO.md` item 4). Those are a design project,
not a responsiveness fix, and stay cut from v1. This item is only "nothing is
broken or embarrassing at any width."

### 8. Notification surface 🟡 · **1h or 4–6h — decision pending**

Notifications already surface on home via `NeedsAttentionRail`, so this is *not*
the blocker it's sometimes described as. But the settle→confirm loop only
completes when the payee notices, and today nothing signals them ambiently.

**There is no bell icon** — both navs are Home · Groups · Activity · Me, and
notifications live inside `/me`. Two options, written up in `TODO.md` "Now" §4:

- **A — badge the Me tab, ~1h.** `TabBar.tsx` already has the whole render path;
  it's fed from a hardcoded empty object. Cheap, semantically muddy.
- **B — global notification icon in a shared mobile header, 4–6h.** Preferred,
  but requires extracting a shared header that doesn't exist today (five routes,
  three different patterns, two with no header at all). Absorbs part of item 6.

Both need the same unread-count query, so A can be upgraded to B later without
rework. **B is the largest P1 item** — if launch timing tightens, ship A.

Also gated on P0 item 1: a count is only useful once notifications reach the
right person.

**P1 total: 9–15h — 2–4 sessions.** The responsive pass is over half of it, and
it's the item most likely to grow: a QA sweep that finds nothing is fast, and one
that finds six layout bugs is not.

---

## Cut from v1

- **Share an expense** (`/expense/[share_token]`). Currently double-dead: nothing
  sets `share_token`, so no link can exist, *and* the query selects
  `payer:profiles!paid_by(*)` when `paid_by` FKs to `group_members` — PostgREST
  can't resolve it, so every token would render "invalid" anyway. Pre-seat-model
  code. Fixing means rewriting the joins **and** adding a Share button, ~3–4h.
  It's listed in `CLAUDE.md` as a headline feature, so cutting it is a product
  call — but it hurts nobody today because it's unreachable. If it stays cut,
  also narrow that `profiles(*)` select before the route is ever reachable: it
  pulls `email` and `claim_token` on an unauthenticated service-role endpoint.
- **Itemized splits**, **emoji reactions**, **spending leaderboard**, **desktop
  3-column home**, **nav FAB** (`TODO.md` item 7), **cross-group settlement
  batching**. All either hidden or degrade gracefully.
- ~~**Guest claim flow.**~~ Shipped 2026-08-11 alongside the invite-path fix
  above (P0 §3) — see `docs/flows.md` § Claim a guest seat. `CLAUDE.md` still
  describes this as Phase 2 / not-in-MVP scope; `docs/` and the actual code
  have moved past that.
- **Generated Supabase types** (17 `as any` waiting), **optimistic updates**,
  **`groups/new` decomposition** (816 lines, now the largest file), **batched
  dashboard fan-out** (3N queries on home). All real, none user-facing.

---

## Critical path

```
1. Settlement notifications  ──►  2. Dashboard settle writes
   (2–3h, decision first)          (2–3h)
                                        │
3. Invite path  ─────────────────┐      │
   (4–6h, independent)           │      │
                                 ▼      ▼
                        6. Mobile presentation (2–4h)
                                 │
                                 ▼
                        7. Responsive pass + QA sweep (5–8h)
                                 │
                        4, 5, 8. CI, server-only, badge (2–3h, any time)
```

Items 1→2 are strictly ordered. Item 3 touches nothing they touch and can go
first or in parallel — worth considering, since it's the one that actually stops
people using the app.

**The QA sweep goes last** and gates the release. Running it before the P0
features land means testing screens that are about to change, then testing them
again. Item 6's known bugs are worth fixing *before* the sweep, though — no
point rediscovering them on fourteen screens.

**Minimum publishable: 8–12h** (P0 only — functional, unverified across widths).
**Recommended: 18–27h** (adds CI, the guard, mobile fixes, the full responsive
sweep, and the badge).

Roughly **4–7 focused sessions.** ~~Four~~ **three** 🟡 decisions gate the work
and are worth making before the next session starts:

1. ~~Do payee-recorded settlements skip the pending state?~~ **Decided
   2026-08-05: yes.** Shipped as far as the database — see item 1.
2. Does Share ship or get cut? (above)
3. Does the JS sheet breakpoint move to 1023px to match the layout CSS? (item 7)
4. Notification surface — badge the Me tab (1h) or global icon in a shared
   header (4–6h)? (item 8; full write-up in `TODO.md` "Now" §4)

---

## Risks

- **Item 3 is the only one with real unknowns.** The stranger-with-a-link path
  has never been exercised end to end; the RLS analysis says it fails, but
  there may be a second failure behind the first. Budget the full 6h.
- **No CI until item 4**, so every estimate above assumes manual verification.
  Doing item 4 first would be defensible.
- **Test coverage is 47 tests over `lib/` only** — splits, balance, feed. No
  component or integration tests.
- **The item 1 trigger migration shipped unverified** (2026-08-05). It applied
  cleanly, but nothing automated covers triggers and no settlement has been
  recorded against it by hand yet. It is currently unreachable — every insert
  still goes down the `pending` branch, which is the pre-existing behaviour —
  so the risk is deferred, not taken. **Exercise both branches manually the
  moment phase 1 lands**, and check that the `settlement_recorded` row reaches
  the payer rather than the recorder.
