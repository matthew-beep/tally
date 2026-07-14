# Review findings — working notes

Companion to [review-checklist.md](./review-checklist.md) (the reading
order). Capture findings here as you review; keep `TODO.md` clean until a
finding is confirmed and worth scheduling. Suggested tags: **[bug]**
**[consolidate]** **[question]** **[style]** **[verified-ok]**.

When a phase is done, triage its findings: promote real items to `TODO.md`,
drop the rest, and note anything that changed your mind about existing plans.

---

## Decisions to make during the review (pre-seeded)

- [ ] **RLS dashboard check** (Phase 1 exit question) — record here, per
  table: RLS on/off + policy summary. This unblocks the baseline-migration
  item in TODO → Prod readiness.
- [x] ~~`AddMemberModal.tsx` / `BalanceBreakdownModal.tsx` fate~~ —
  resolved 2026-07-13: all dead code deleted (recoverable from git).
- [ ] **`DeleteGroupSheet` policy** (Phase 4) — should group delete require
  all balances at $0.00 (per original spec)? Currently unenforced.
- [ ] **Shared balance core** — design settled (2026-07-13), worth doing,
  not yet built. The dashboard is a *fold over* group views — same math,
  different identity layer (seat id per group vs profile id globally;
  guests are seat-only). Approach:
  - `lib/balance.ts`: add `calcPairwiseNets(myId, expenses, settlements)`
    (pure, seat-space, one group — the algorithm currently duplicated in
    group detail `page.tsx` ~95–118 and `useGlobalBalances` ~183–216) and
    `summarizeBalances(pairwise) → { net, owedToMe, iOwe }`.
  - Group detail: replace the inline pairwise block with one call.
  - `useGlobalBalances`: per group → `calcPairwiseNets` → translate seat →
    profile via existing `effectiveId` → merge into `pairwisePerGroup`;
    hero gross/net from `summarizeBalances` (deletes the separate
    gross loops with the `Math.max(0)` floor — hero then exactly equals
    the sum of the person rows; edge-case numbers shift, which is a fix).
  - `buildPeopleFlow` unchanged; its `PersonEntry`+`parts` shape is the
    unified people-relation shape (group page = single-part special case —
    future shared hero/person-row components hang off this).
  - Tests incl. consistency invariant:
    `summarizeBalances(calcPairwiseNets(me,…)).net === calcNetBalances(…)[me]`.
  - Order: lib + tests green → group-page swap → hook restructure →
    compare both screens' numbers in dev.
- [ ] **Desktop verification** — fill in the blanked Desktop cells in
  [feature-status.md](./feature-status.md) as each screen is exercised.

## Consolidation pass 2 (2026-07-13, pre-review sweep)

Follow-up to the first duplication audit (balance math ×3, avatar slots ×8,
display-name fallback, invalidation lists — all in TODO → Consolidation).
Ranked: #1–2 are the high-value items; #3 pairs with planned work; #4–7
are batch-someday polish; #8 is a ten-second delete.

1. - [ ] **[consolidate][bug] `postJson` helper — no standard fetch exists.**
   Five call sites hand-roll `fetch('/api/…')` with four different failure
   behaviors:
   - `invite/[token]/page.tsx:90` — **silently swallows failure**
     (`setSubmitting(false); return` — no message, no throw). A bug in its
     own right, same class as the add-member one fixed 2026-07-13.
   - `add/[add_code]/page.tsx:39` — generic throw, discards server message
     (429 rate-limit text invisible here)
   - `useGroups.ts:115` — parses `.error` but no `.catch` on `res.json()`;
     a non-JSON error response (gateway 502) crashes with a parse error
   - `useMembers.ts` decline + group detail `handleAddMembers` — the good
     pattern (parse with `.catch(() => null)`, readable fallback)
   Fix: `src/lib/api.ts` → `postJson(path, body)` that always throws the
   server's `{ error }` message (fallback `Request failed (status)`);
   migrate all five. Future routes inherit correct behavior.
2. - [ ] **[consolidate] Feed merge ×2** — group detail page inlines a
   tagged merge of expenses+settlements (`_type`, sort `created_at`, group
   by month); `useActivity.ts` builds its own (`type`, grouped by group).
   Extract `mergeFeed(expenses, settlements)` → one sorted tagged timeline;
   both consumers shape from it. This is also the seam where feed
   pagination lands later (merged timeline, not expenses alone).
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

_(findings)_

## Phase 3 — Entry & auth-adjacent pages

_(findings)_

## Phase 4 — Core UI: the money screens

_(findings)_

## Phase 5 — Dashboard shell & remaining screens

_(findings)_

## Phase 6 — Modal system, atoms, CSS

_(findings)_
