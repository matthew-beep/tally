# TODO

Completed phases (Supabase setup, auth, member-status model, notifications,
handle/identity system, settle-up rework, status-filter audit) have been
pruned — see `docs/` for how the shipped systems work and git history for the
old checklists.

**Legend:** 🟢 = mechanical / well-specified — Claude can run it solo.
🟡 = needs Matthew's oversight — a product/UX decision, prod credentials, or
a design reference.

---

## Pre-ship punch list (2026-07-26 planning session)

Matthew's list of what's left before shipping, in his priority order. Supersedes/pulls forward the overlapping items below (settle-up UX, desktop responsiveness, expense reactions) — this section is the source of truth for sequencing; the sections below still hold the implementation detail.

1. **Settlement flow — UX pass** 🟡 — not a functionality gap (create/confirm/deny all
   work end-to-end), it's that the flow itself feels bad. Diagnosed: `/groups/[id]/settle`
   is a full-page route with its own hand-rolled mobile chrome (safe-area spacer,
   back-button header, 480px-centered column) — inconsistent with how every other
   money-entry flow in the app now works.
   - **Direction agreed:** convert it to a modal/drawer sheet using `ModalOrSheet`
     (`src/components/modal`) — the same primitive `AddExpenseSheet`, `BalanceSheet`,
     and `PersonProfileSheet` already use (Vaul bottom sheet on mobile, centered modal
     on desktop, drag-to-dismiss). Model directly on `AddExpenseSheet` in
     `AddExpenseForm.tsx` (form component takes `onSuccess`/`onCancel` instead of doing
     `router.push`; a thin wrapper component renders `ModalOrSheet` around it).
   - Two same-page trigger sites move from `router.push('/groups/${groupId}/settle')`
     to local sheet-open state, same pattern as `addExpenseOpen`:
     `src/app/(dashboard)/groups/[id]/page.tsx` — desktop header-band CTA (~line 218)
     and the per-member "Settle up" row button (~line 472).
   - The `/groups/[id]/settle` route itself should stay addressable (Home's
     `BalanceSheet` cross-group CTA navigates to it — `src/components/home/BalanceSheet.tsx`
     ~line 154 — since the target group may differ from the page you're on) but its
     page component becomes a thin wrapper rendering the same sheet pre-opened,
     closing back to the group page instead of a custom full-page layout.
   - This also incidentally fixes desktop presentation for settle-up (item 4 below) for
     free, since `ModalOrSheet` already branches mobile/desktop.
   - **Decided 2026-08-02 — pairwise wins, `/settle` deleted.** The two entry points
     used different debt models (`SettleUpSheet` on `calcPairwiseNets`, `/settle` on
     `simplifyDebts(calcNetBalances(...))` — greedy min-transfer, could name a
     counterparty you'd never split with). Turned out moot: by the time this was
     decided, nothing in the app linked to `/settle` anymore — the group-page
     triggers and home's cross-group CTA had already been migrated to `SettleUpSheet`
     in the same day's earlier commits. So this wasn't "collapse route into sheet,"
     it was "delete now-orphaned code": `src/app/(dashboard)/groups/[id]/settle/`
     deleted outright (no redirect — nothing points at the URL), `simplifyDebts` +
     its 5 tests deleted from `lib/balance.ts`/`balance.test.ts` (only caller was the
     deleted route), `DebtTransfer` type deleted (only used by `simplifyDebts`).
     `CLAUDE.md`, `docs/flows.md`, `docs/features.md`, `docs/review-checklist.md`
     updated to stop describing the min-transfer model / the dead route. Typecheck
     + full test suite clean (45/45, down from 50 — the 5 deleted tests).
   - **Visual/interaction reference found** (2026-07-26): claude.ai/design project
     "splitter" (`36d6382c-156c-422e-afd2-063025ff0a0f`), file `Settle Up Flow.html`
     (imports `variation-settle-flow.jsx` + `settlement-confirm.jsx` +
     `tally-shared.jsx`). Only the drawer pieces apply — the group-page redesign and
     the full-screen success states (`SFPaymentSent`/`SFSettlementConfirmed`) are out
     of scope for this item. Two drawers worth matching:
     - `SFSettleSheet` — list split into "Owed to you" (Remind) / "You owe" (Pay),
       not a single select-a-transfer radio list like the current page.
     - `SFRecordPayment` — payment-method chips (Venmo/Zelle/Cash/PayPal/Other) + note,
       opened on top of the settle list.
     Implementation note: the mockup renders these as two independently-stacked
     absolute overlays, which is a static-HTML trick, not something to reproduce with
     two nested Vaul `Drawer.Root`s. Match `ExpenseActionSheet.tsx`'s pattern instead —
     one sheet, internal `screen` state (`'list' | 'record-payment'`) swapping content.
   - **Decisions made against the reference:**
     - **Payment method → real column.** Add `settlements.method` via migration
       (not folded into `note` as text) — schema change, touches RLS/types same as any
       other column addition.
     - **Keep the amount editable**, unlike the mockup's fixed non-editable hero number
       — matching it exactly would regress the "partial settlements just work"
       invariant (see CLAUDE.md). Record-payment step pre-fills from the transfer amount
       but the field stays editable.
     - **No `settled_date` field in the UI** — keep defaulting it to today under the
       hood, same as the mockup implies (drop the date picker from the current page).
     - **"Remind" button — decided against, not deferred** (superseded
       2026-07-31, see approach note below): dropped entirely rather than
       stubbed. The debt showing up on the dashboard/group balance already
       does the reminding; owed-to-you rows get "Mark as paid" instead, no
       separate no-op action.
     - **`SFIncomingConfirm`-as-group-page-banner is a separate, smaller addition** —
       today confirm/deny only lives on `/me`. The mutations
       (`useConfirmSettlement`/`useDenySettlement`) already exist and are cheap to
       reuse for a group-detail banner + sheet, but treat it as its own task, not
       part of the settle-drawer rebuild.
   - **Approach note (2026-07-31)** — worked out while investigating why the
     group page and `useGlobalBalances` don't share one balance path (they
     can't: `settlements.from_member_id`/`to_member_id` FK to `group_members`,
     so anything writing a settlement needs seat-keyed data, while
     `useGlobalBalances` deliberately re-keys seats → profile ids at its merge
     step for cross-group folding). Net of that: `SettleUpSheet` should be a
     **dumb, props-driven component** — no `useGroupDetail`/`calcNetBalances`/
     `simplifyDebts` calls inside it at all. The caller (group page or
     dashboard) already has the numbers computed; hand them down instead of
     making the sheet re-fetch and re-derive:
     ```ts
     interface Transfer { groupMemberId: string; amount: number; direction: 'owed' | 'owe' }
     // <SettleUpSheet groupId mySeatId transfers={Transfer[]} preselect={Transfer | null} .../>
     ```
     - **Group page**: `page.tsx`'s existing `oweMeEntries`/`IOweEntries`
       (built from `calcPairwiseNets`, not `simplifyDebts` — this also fixes a
       latent mismatch where the old sheet's list screen used the group-wide
       minimum-transfer matching while the balance card showed direct pairwise
       nets, i.e. two different numbers for the same person) map straight onto
       `Transfer[]`; the per-member "Settle up" button already has `amount` and
       `memberId` in its closure and can hand over a fully-formed `Transfer` as
       `preselect`, no lookup needed.
     - **Dashboard**: `PersonEntry.parts` (`(dashboard)/page.tsx`'s
       `buildPeopleFlow`) is already `Transfer`-shaped per group, just missing
       a `groupMemberId` (it's profile-keyed, from `useGlobalBalances`). One
       small shared helper resolves seat ids on demand:
       `resolveSeatId(gb, groupId, personId) = gb.membersPerGroup[groupId].find(m => m.user_id === personId || m.id === personId)?.id`
       — used both for the counterparty and for "my seat in that group."
       `BalanceSheet.tsx`'s existing settle CTA already picks
       `visibleParts[0]` (largest balance) before navigating to
       `/groups/:id/settle`; same default, just resolve seats and open
       `SettleUpSheet` in place instead of routing away. A person with
       balances in >1 group only ever needs the single largest-balance
       `Transfer` for a plain row tap — a real "settle all groups at once"
       multi-insert flow is Pre-ship #5 (dashboard path) / Later if #5 ships
       single-group only, not implied by this.
     - Net effect: one shared sheet/screens, zero branching inside the sheet
       on which surface opened it — the fork is entirely in how each caller
       builds its `Transfer`(s) before rendering the sheet.
   - **Follow-up decisions (2026-07-31)** — both extend the same
     `Transfer.direction` field, no new prop needed. **Generalized
     2026-08-03 — see item 5 (a)–(e) for the settled model**; the
     creditor-skips-pending rule below is a special case of 5(a), and the
     `settlements.method` column decided above may belong on a payment
     rather than per allocation (5(c)).
     - **Owed-to-you rows become actionable: "Mark as paid."** Today's list
       screen only had a no-op "Remind" for that direction (see above — now
       dropped, not just stubbed). Tapping it opens the same record-payment
       screen as "Pay," tagged `direction: 'owed'`.
     - **Creditor-initiated settlements skip the pending/confirm step
       entirely** — if I'm marking that someone else already paid me, I'm
       not asking myself to confirm my own claim. Two things need to change
       for this, both currently hardcoded for the debtor-initiated case only:
       - `useCreateSettlement` (`useSettlements.ts`) inserts
         `status: 'pending'` unconditionally — needs to insert `'confirmed'`
         directly when `direction === 'owed'`. Schema already allows it
         (`CHECK (status IN ('pending','confirmed'))`), no migration needed
         for this part.
       - `notify_settlement_created` (the `AFTER INSERT` trigger) currently
         fires `settlement_confirm` to `to_user` unconditionally — for a
         confirmed-on-insert row `to_user` is the inserting user themselves,
         which is wrong (asks you to confirm your own action). Needs to
         branch on `NEW.status`: `pending` → existing `settlement_confirm`
         to `to_user`; `confirmed` → `settlement_confirmed` to `from_user`
         instead (an FYI: "X marked you as settled," informational, not
         action-required). Small migration, same shape as the existing
         trigger.
     - **No dispute mechanism for a wrongly-marked "they paid me" claim** —
       consistent with the existing "denial = DELETE, no disputed state"
       invariant, just extended to a claim the other party made. The
       mitigation is being able to delete a settlement after the fact (next
       item), not a formal dispute flow.
   - **New: delete a settlement** (2026-07-31) — nothing exists for this
     today beyond `useDenySettlement`, which only ever targets `pending` rows
     from the `/me` deny flow. Needed pieces:
     - `useDeleteSettlement` mutation — same DB operation, new call site for
       arbitrary (including confirmed) rows.
     - A UI entry point — settlement rows in the group feed
       (`groups/[id]/page.tsx`'s feed rendering) aren't tappable at all today,
       unlike the expense rows right above them (`onClick={() =>
       setExpenseSheet(e)}`). Needs its own small action sheet, not just
       reusing `ExpenseActionSheet`.
     - **Permission — decided:** only the two people party to the settlement
       (`from_member_id` or `to_member_id` matching the caller's own seat)
       can delete it — not any active group member. `docs/review-todo.md`'s
       RLS audit only flagged `settlements` UPDATE as needing payee-only
       tightening; DELETE was never restricted, so it's likely still open to
       any group member via the general group-scoped policy today. Deleting
       (not just denying-while-pending) needs its own migration to add that
       restriction — don't assume the existing policy already covers this.

2. **Emoji reactions on expenses** 🟡 (schema + UX) — react to an expense with an emoji,
   this is a new concept, not an extension of the existing group-emoji or category-emoji
   pickers.
   - **Schema direction agreed:** a new table, not a column on `expenses` — same shape as
     `expense_history`/`notifications` (append-only rows joined in). Proposed:
     ```sql
     expense_reactions (
       id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       expense_id      uuid REFERENCES expenses ON DELETE CASCADE NOT NULL,
       group_member_id uuid REFERENCES group_members ON DELETE CASCADE NOT NULL,
       emoji           text NOT NULL,
       created_at      timestamptz DEFAULT now(),
       UNIQUE (expense_id, group_member_id, emoji)
     )
     ```
   - **Reaction shape agreed:** Slack-style — one person can add several distinct emoji
     reactions to the same expense; tapping an emoji they've already used removes it
     (not a single replaceable reaction slot). The `UNIQUE(expense_id, member, emoji)`
     constraint is what makes this cheap.
   - **RLS pattern** — mirror what's already in the baseline migration
     (`supabase/migrations/20260721000000_baseline_schema.sql`):
     - SELECT: `expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT get_my_group_ids()))`
       (same join-through-expenses shape as `expense_splits`/`expense_items`).
     - INSERT/DELETE: scoped to your own row, same shape as the `settlements: payee can
       update` policy — `group_member_id IN (SELECT id FROM group_members WHERE user_id
       = auth.uid())`, ANDed with the SELECT's group-membership check on INSERT.
   - **Data loading** — add `reactions:expense_reactions(id, emoji, group_member_id)` to
     the nested select in `expensesQueryOptions` (`src/queries/useExpenses.ts`), same
     pattern already used there for `splits` and `payer`. Reactions ride along with the
     expense feed for free; toggling one just invalidates `['expenses', groupId]`.
   - **UI** — home is `ExpenseActionSheet.tsx` (the expense detail sheet): grouped pills
     (emoji + count), highlight ones you've reacted to, tap to toggle. "Add reaction"
     button opens a picker adapted from the existing `EmojiPickerSheet.tsx` component —
     it's single-select with a highlighted "current" emoji today; reactions need the
     highlight/current concept dropped (multiple picks, no "current").

3. **Spending leaderboard** 🟡 (needs a design pass — nothing scoped yet beyond this) —
   **per-group**, ranks members by total paid. Lives on the group detail page. Was
   previously filed under "Later (Phase 2+/3)" as a vague "group leaderboards" bullet —
   promoted here now that scope (per-group, ranked by amount paid) is confirmed. Open
   questions for next time: exact placement on the page, whether it's all-time or
   filterable by date range, tie-breaking.

4. **Responsive views for every screen** 🟡 — no new decisions made this session; this is
   the existing "Desktop / web layout — remaining" backlog further down this file
   (home 3-column layout, modal sizing audit, group settings desktop treatment, the
   §19e Vaul conversion for `ExpenseActionSheet`). Settle-up's desktop gap gets fixed
   as a side effect of item 1 above.

5. **Finish cross-group settlement flow from dashboard** 🟡 — **UI shipped
   2026-08-02; seat plumbing + confirm-screen copy shipped 2026-08-03;
   writes still open.** `BalanceSheet.tsx` no longer routes away to a group
   page at all (the `/groups/[id]/settle` route it used to target is
   deleted, see item 1). It has its own two screens, both still no-op on
   the write:
   - **Balance screen's "Settle up with X" CTA** → a settle-all confirm
     screen: total, every group at its full balance, single confirm button.
   - **Tapping a specific group row** → a new `GroupSettleScreen`, drilled
     into in place (no navigation): that one group's balance as a big
     editable number, Full/Half/Clear quick-set chips, its own "Settle $X
     in [Group]" button. Settling here never touches the person's other
     groups.
   Both buttons are `onClick={() => {}}` today. Reference design:
   `Dashboard Settle.html` in the `splitter` claude.ai/design project
   (`36d6382c-156c-422e-afd2-063025ff0a0f`).

   **Landed 2026-08-03 — seat resolution.** `PersonPart` hoisted to
   `src/types/index.ts` (it was declared three times identically — dashboard
   page, `BalanceSheet`, `PersonProfileSheet`) and extended with
   `groupMemberId` (counterparty's seat) + `mySeatId` (mine — differs per
   group). `resolveSeatId(gb, groupId, personId)` added to
   `useGlobalBalances.ts`; `buildPeopleFlow`'s `.map` became a `.flatMap`
   that fills both. Needed because money writes are seat-keyed
   (`settlements.from_member_id`/`to_member_id` FK `group_members`) while
   everything cross-group is profile-keyed. The helper tries both
   `user_id` and `id` because `effectiveId` (`useGlobalBalances:45`) folds
   real users to their profile id but leaves guests on their seat id — so
   `personId` is not consistently one kind of id. `BalanceSheet` stays
   dumb/props-driven; a part now carries everything needed to write its own
   settlement row with no further lookup.

   **Landed 2026-08-03 — confirm screen.** Settle-all's CTA names the row
   count, and a line above it states the notification consequence
   (direction-aware — see (a)). CTA disabled at `groupCount === 0`. Both
   still `onClick={() => {}}`. **Superseded in part by (b) below:** the CTA
   currently shows `Math.abs(net)`, which is the wrong figure for
   mixed-direction batches and must become gross before the write lands.

   ---

   **Decided 2026-08-03 — the settlement/payment model.** Worked out in one
   session; this is the only record of it. Five linked decisions:

   **(a) Confirmation status is directional.** The rule is not "who
   initiated it" but *does my claim improve my own financial position?*

   | What I record | Status | Other person gets |
   |---|---|---|
   | I owe you → I paid you | `pending` | Confirm request (action) |
   | You owe me → you paid me | `confirmed` | FYI notification |

   Claiming I paid a debt is self-serving, so it needs the payee's
   assent. Claiming someone paid me *removes* money owed to me — it costs
   me, not them, so there's nobody to protect. They still get told, because
   their balance moved. Same rule as item 1's follow-up decision, stated
   generally.

   **(a′) Amended 2026-08-03 — status is a property of the payment, not of
   each allocation.** Applying (a) per row breaks on mixed-direction
   batches. Worked example: Apartment (Alex owes me $20), Big Sur (I owe
   $25), Dinner (I owe $15). Per-row status gives two `pending` rows summing
   to $40, so Alex is asked "Matthew says they paid you $40" — but the
   transfer Matthew actually sends is the **net $20**. Alex is being asked to
   vouch for a payment that never happened in that shape.

   Fix: compute the **net across the batch**, and let its sign set the
   status for *every* row in the batch:
   - Batch nets to *I paid you* → self-serving → whole batch `pending`,
     payee gets one confirm request **for the net**.
   - Batch nets to *you paid me* → costs me → whole batch `confirmed`,
     payer gets one FYI.

   (a)'s principle is unchanged — it's asked once per payment instead of
   once per row, which is just (c) applied one level further. Per-row status
   was an artifact of thinking settlement-first.

   **Rejected alternative: "any row pending → batch pending."** Agrees with
   net-direction in the common case but inverts in one: Apartment (Alex owes
   me $50) + Big Sur (I owe $10) nets to Alex paying me $40, yet has a
   pending row — so that rule would ask Alex to confirm a payment Alex is
   *receiving credit for*. Net-direction gets it right (`confirmed`, FYI to
   Alex).

   Consequences: no schema change — `settlements.status` stays per row, just
   always uniform within a batch. Deny deletes the whole batch including the
   offsetting rows (the offset only existed as part of that netting); confirm
   flips the whole batch. Both already follow from (d). And notification
   grouping gets *simpler* than (e) assumed — since every row in a batch
   shares one status, a batch always produces one card of one type, never
   the two-cards-of-two-types case (e) was written against.

   The gross/net split lands where it belongs: **allocations are gross**
   (that's what zeroes each group), **the payment is net** (that's what
   someone confirms).

   **(b) Settle-all means "zero every open group with this person," not
   "settle the net."** Directions can differ per group (owe in Apartment,
   owed in Big Sur — a normal case, not an edge one). The action settles
   each group at its own full balance, so the money moved is **gross**.
   Example: owe $30 in Apartment, owed $20 in Big Sur → hero says "you owe
   $10," but settle-all writes a $30 row and a $20 row, allocating $50
   across the two groups. The net alone must not stand as the CTA figure.
   Review state shows both directions and the gross total:
   ```
   Settle everything with Alex
     You pay Alex   $30
     Alex pays you  $20
     2 groups · $50 total
   ```
   Settling the net instead was rejected: it can't be expressed anyway
   (settlements are group-scoped, so zeroing both groups requires touching
   both), and it would leave balances open after an action called "settle
   all."

   **Refined by (a′)** on two points. First, statuses: both rows above take
   the batch's status, not their own — the batch nets to "I owe $10," so
   both are `pending`. Second, the review screen should also name the **net
   transfer**, because that's the money that actually moves and the figure
   the payee gets asked to confirm. Show both — gross per direction, net as
   the transfer. Neither alone is honest: net alone hides that two groups
   are being zeroed, gross alone implies $50 changes hands when $10 does.

   **(c) A payment is not a settlement.** One Venmo transfer of $45 is one
   payment; the settlement rows are its *allocation* across groups.
   Settlements stay group-scoped and seat-keyed — the payment identity is
   carried as a stamp, not a table:
   ```sql
   ALTER TABLE settlements
     ADD COLUMN batch_id uuid NOT NULL DEFAULT gen_random_uuid();
   ```
   **Every settlement gets one**, not just batched ones. Nullable-when-
   standalone is cheaper in the migration and more expensive everywhere
   downstream — notification grouping, confirm mutation, card copy would
   each need an "is this batched" branch. Universal means a lone settlement
   is a batch of one and the single case is the degenerate version, not a
   special case. Two consequences of the default: `useCreateSettlement`
   (singular) needs **no changes** — Postgres fills it; and existing rows
   backfill correctly for free, each becoming its own batch, which is what
   they were.

   Balance math is untouched by all of this. The invariant counts
   settlements with `status IN ('pending','confirmed')` — i.e. all of
   them — so confirmation status has never affected balances, and moving
   the confirmation concept up to payment level doesn't reach
   `calcPairwiseNets`/`calcNetBalances` at all. Blast radius is the
   settle/confirm/notify path only.

   **(d) No partial confirm — confirm/deny always act on the whole batch.**
   Earlier sketches had an expandable card letting the payee confirm one
   group and deny another. That models something physically impossible: one
   transfer either arrived or it didn't; you can't half-receive $45. If the
   payer really did pay per group, they'd settle per group (the group-page
   `SettleUpSheet` path is unchanged), producing separate batches — so the
   action boundary and the payment boundary line up by construction.

   **(e) Batching applies to all four notification types, not just the
   request.** `notify_settlement_denied` and `notify_settlement_confirmed`
   currently fire per row, so a payee confirming a 3-row batch sends the
   payer three "✓ confirmed" notifications and denying sends three
   denials — the same spam, reverse direction. Grouping must cover the
   info rows on `/me` too.

   **Simplified by (a′):** every row in a batch now shares one status, so a
   batch always yields **one card of one type**. (e) was written assuming a
   mixed batch could produce a confirm card *and* an FYI card side by side;
   that case no longer exists. The card leads with the net transfer and
   lists the allocations beneath it:
   ```
   Matthew says they paid you $20
     Big Sur     you receive  $25
     Dinner      you receive  $15
     Apartment   you paid     $20   (offset)
     ─────────────────────────────
     Net to you  $20
     [Confirm $20]   [Deny]
   ```

   **Implementation fork (decided: client-side grouping).** Notifications
   are trigger-owned — CLAUDE.md: "App code never writes to `notifications`
   directly" — and `notify_settlement_created` is `FOR EACH ROW`, so the
   client cannot create one notification spanning N rows. Two ways out:
   - **Rejected for now:** statement-level trigger with a transition table
     (`REFERENCING NEW TABLE AS new_rows`) emitting one notification per
     INSERT statement. Matches the model exactly and handles the 1-row case
     identically, but the read path breaks: a notification pointing at N
     settlements can't use `notifications.settlement_id`, and can't FK to
     `settlements.batch_id` either (not unique — N rows share it), so
     PostgREST embedding at `useProfile.ts:130` stops working. Doing it
     properly wants a `settlement_batches` table both tables FK to.
   - **Chosen:** triggers stay per-row; `useNotifications` groups the
     returned rows by `settlement.batch_id` and renders one card per batch.
     The action is still the boundary — nothing inferred from timestamps.
     Costs one nullable-free column and no notification schema change.
     The bell badge must count **distinct batches**, not rows; that query
     doesn't exist yet (`useProfile.ts:120-124`), so it gets written that
     way from the start rather than retrofitted.
   `batch_id` is forward-compatible: if a real `payments` table is ever
   wanted (the natural home for `method`/`note`/`paid_date` — see item 1's
   `settlements.method` decision, which arguably belongs there instead), it
   becomes the FK and nothing built now is thrown away.

   **(f) Every settlement notifies the counterparty — confirmed 2026-08-04.**
   No settlement direction is silent. The type differs, the delivery doesn't:

   | I record | Counterparty gets | Actions |
   |---|---|---|
   | I owe you → I paid you | confirm request | Confirm / Deny |
   | You owe me → you paid me | FYI | Dismiss only |
   | Batch (either direction) | one card for the **net**, per (a′) | per the batch's status |

   The FYI row is dismiss-only by design — there is nothing to approve (see
   (a): the claim costs the recorder, not the recipient), but the recipient's
   balance moved, so silence isn't an option. "Dismiss" is just the existing
   `read` flag; no new mechanism.

   **Decided 2026-08-05 — the FYI gets its own type, `settlement_recorded`.**
   Item 9's proposal won over item 5 step 1's "reuse `settlement_confirmed`,
   no migration." Reuse would render "Alex confirmed your payment ✓" and
   "Alex marked you as settled" as one type, forcing `infoLabel()`
   (`me/page.tsx:120`) to re-derive which event it was from the settlement
   row; a distinct type keeps the copy honest, and widening
   `notifications_type_check` is a few lines. **Shipped** in
   `20260805000000_settlement_notification_direction.sql` (applied to the
   linked project the same day) — see the plan below for what still has to
   land client-side before it does anything.

   **The batch card's dropdown lists groups, not expenses.** Settlements have
   never been tied to individual expenses — that's what makes "partial
   settlements just work" (CLAUDE.md). A $45 payment allocates across *groups*
   at whatever each group's balance is; there is no expense-level breakdown to
   expand into. The card in (e) is the shape: net transfer on top, one line per
   group underneath, offsetting rows marked as such.

   **Group feed shows settlements plainly — no cross-group annotation.**
   Rejected "Matthew paid Alex $30 · part of a $45 payment": the group feed
   is visible to *every* active member, so that leaks to bystanders that
   Matthew and Alex have business in a group they can't see. "Matthew
   settled $30 with Alex" is complete and true within that group's ledger.

   **Reopened 2026-08-04 — do settlements show in the group feed at all?**
   Previously recorded here as rejected. Matthew raised it again, so it's an
   open decision, not a closed one. Mechanically it's cheap: `mergeFeed`
   (`src/lib/feed.ts:10`) is presentational only — it concatenates and sorts,
   and balance math (`calcPairwiseNets`/`calcNetBalances`) reads the
   `settlements` query directly and never goes through it. So
   `mergeFeed(expenses, [])` at `groups/[id]/page.tsx:84` hides the rows with
   settling still zeroing the group exactly as before.
   - **The standing objection:** the group's balance changes with no visible
     cause — Alex goes from $30 to $0 and the feed says nothing. If this ships,
     it likely needs a replacement affordance (a "settled" divider, or folding
     the event into the balance card), not a plain deletion.
   - **Second call site:** `useActivity.ts:38` also calls `mergeFeed`, feeding
     `/activity` and the home rail. Since activity went flat-and-chronological
     with the group as row metadata (`showGroup`), the same settlements
     reappear there tagged with the group they were just hidden from. Decide
     whether the scope is "the group detail page is expenses-only" (one call
     site) or "settlements are never shown in a group context" (both).
   - **Not the privacy fix.** If the concern is bystanders inferring
     cross-group business, that's already handled above — the plain row leaks
     nothing. This decision is only about ledger noise.

   **Storing settlements relationship-level instead of group-scoped was
   considered and rejected.** It would make one payment one row and dissolve
   the allocation problem, but a group could then no longer compute its own
   balance from its own rows — it'd have to decide at read time how much of
   a $45 payment belonged to it, an answer that shifts every time someone
   adds an expense. That breaks the balance invariant, which is the core of
   the app.

   **Guests:** a guest exists in exactly one group and has no profile, so a
   guest settle is always a batch of one and stays on the per-row path. No
   special handling needed; noted so it isn't rediscovered as a bug.

   **Copy:** `Confirm payment` (one) / `Confirm payments` (multiple), and
   `Confirm $45` for a batch — the amount is more informative than "all,"
   and matches the design system's "be plain about money" rule.

   **This departs from CLAUDE.md deliberately.** Its cross-group section
   says settlement is "UI aggregation, not a data model change" and that
   each group's settlement "generates its own confirmation notification to
   the payee." (b)–(e) override that. The spec predates anyone thinking
   about notification volume. **CLAUDE.md still needs a supersession
   pointer — not yet written.**

   ---

   **Remaining work, in order.** Written up as a plan 2026-08-05. Phase 1 is
   mechanical and unblocks everything; phase 2 is the batch model; phase 3 is
   the cleanup that shouldn't ship after the flow it protects.

   ### Phase 0 — trigger status branch ✅ **done 2026-08-05**

   - [x] `20260805000000_settlement_notification_direction.sql`, **applied to
     the linked project** (`migration list` shows it local + remote). Widens
     `notifications_type_check` with `settlement_recorded` and rewrites
     `notify_settlement_created` to branch on `NEW.status`: `pending` →
     `settlement_confirm` to the payee; `confirmed` → `settlement_recorded`
     to the payer, informational. Guest seats notify nobody in either branch
     (the `user_id IS NOT NULL` guard is unchanged). Flagged under item 1
     since 2026-07-31; it blocked (a)'s confirmed rows and item 1's "mark as
     paid" alike.
   - **No `recorded_by` column** — `docs/publish-roadmap.md:40` called for
     one, but that predates (a′). Status already encodes who recorded it and
     is uniform across a batch, so the trigger has everything it needs. One
     less column, no backfill.
   - [x] `docs/schema.md` updated to match (type list + trigger table). Fixed
     a stale row found en route: `notify_group_invite_declined` was still
     listed as live but was dropped in `20260729000000`.

   ### Phase 1 — activate it client-side ✅ **done 2026-08-05**

   The DB branches on status, but nothing ever inserts `confirmed`, so every
   insert still takes the old path and behaviour is byte-identical to before
   the migration. Until this lands, phase 0 is inert. (DB-ahead-of-client is
   the safe ordering here; the reverse would have written rows the trigger
   mishandled.)

   - [x] **`useCreateSettlement`** (`useSettlements.ts:43`) — stop hardcoding
     `status: 'pending'`. Take the direction from the caller and insert
     `confirmed` when the creditor is the one recording.
   - [x] **`SettleUpSheet.handleConfirm`** (`SettleUpSheet.tsx:181-193`) —
     pass it. `activeTransfer.direction` is already in scope at `:183` for
     the from/to swap, so this is one added field, no new plumbing.
   - [x] **`types/index.ts:88`** — add `settlement_recorded` to the
     `Notification` union.
   - [x] **`me/page.tsx`** — three spots: `INFO_TYPES` (`:113`), a case in
     `infoLabel()` (`:120`), and the amount line at `:217`, which branches on
     `settlement_confirmed || settlement_denied` and would otherwise render
     the new type with no amount under it.
   - **Deliberately nothing** in `useNotifications` — `useProfile.ts:130`
     already embeds the settlement with both members' profiles, so the new
     rows hydrate as-is. And `ACTIONABLE_TYPES` (`(dashboard)/page.tsx:381`)
     already excludes it correctly: a dismiss-only FYI must not reach home's
     `NeedsAttentionRail`.
   - **Verified live**: test-account → gmail-account debtor/creditor pair,
     creditor marked paid, group feed went green + confirmed, gmail account
     got the `settlement_recorded` FYI on `/me` (not on the dashboard rail —
     correctly excluded by `ACTIONABLE_TYPES`, since it's dismiss-only).

   **[bug] found + fixed same day, adjacent to this work — `useConfirmSettlement`
   never marked its own notification read.** `useNotifications()` only returns
   `read = false` rows, but confirming a settlement only updated
   `settlements.status`, never the originating `settlement_confirm`
   notification's `read` flag — so the confirm-request card never went away,
   even though the settlement itself was already confirmed and live in the
   feed. Fixed by giving `useConfirmSettlement` a `notificationId` param and
   marking it read in the same `Promise.all`, matching the pattern
   `useAcceptGroupInvite`/`useDeclineGroupInvite` already use
   (`useSettlements.ts`, `SettlementConfirmCard.tsx`). `useDenySettlement`
   needed no equivalent change — its `DELETE` already cascades the
   notification away via `settlement_id REFERENCES settlements ON DELETE
   CASCADE`.

   **[bug][critical] found + fixed same day — denying a settlement always
   failed.** `notify_settlement_denied()` (`AFTER DELETE FOR EACH ROW`) tried
   to `INSERT INTO notifications (..., settlement_id) VALUES (..., OLD.id)`
   — but the settlement row is already gone by the time an `AFTER DELETE`
   trigger fires, and `notifications.settlement_id` has a strict (non-
   deferrable) FK requiring it to exist. Every deny attempt threw `23503:
   insert or update on table "notifications" violates foreign key constraint
   "notifications_settlement_id_fkey"`, aborting the whole `DELETE` — the
   settlement was never actually denied. Verified live 2026-08-05 against the
   linked project inside a rolled-back transaction (no data persisted); zero
   `settlement_denied` rows existed in the table beforehand, consistent with
   this having never worked since it was written.

   Fix: `20260805010000_settlement_notification_amount.sql`, **applied to
   the linked project**. Added `notifications.amount numeric(10,2)`.
   `notify_settlement_denied` no longer references `settlement_id` at all —
   structurally can't, since deny's whole point is deleting that row — and
   stamps `OLD.amount` onto the notification directly instead, read before
   the `DELETE` takes effect. Applied to all three settlement trigger
   functions (not just denied) for symmetry, and because Phase 3's planned
   "delete a settlement" feature would otherwise cascade-erase
   `settlement_confirmed`/`settlement_recorded` amounts too the moment a
   confirmed settlement is deleted after the fact. Client: `Notification.amount`
   added to `types/index.ts`; `me/page.tsx`'s amount line now reads
   `n.amount ?? n.settlement?.amount` (denormalized path first, FK-join path
   as fallback for the three types that still safely use it). Re-verified
   live post-fix: deny succeeds, notification lands with `settlement_id:
   null, amount: <correct>`.

   ### Phase 2 — the batch model

   - [x] **`batch_id` migration** per (c) — `20260808000000_settlement_batch_id.sql`,
     written and **applied to the linked project** 2026-08-08 (`migration list`
     shows it local + remote). Inert until the client reads `batch_id` —
     same DB-ahead-of-client ordering as phase 0. Contents:
     - `settlements.batch_id uuid NOT NULL DEFAULT gen_random_uuid()`,
       universal per (c). Existing rows each become their own batch for free
       and `useCreateSettlement` (singular) needs no change, since Postgres
       fills it.
     - **`notifications.batch_id uuid` (nullable) — added beyond the original
       plan, and it's what makes grouping work at all.** The plan assumed the
       client could reach a batch through `notifications.settlement_id →
       settlements.batch_id`. That join is dead exactly where batching matters
       most: `settlement_denied` carries `settlement_id = NULL` by
       construction (since `20260805010000` — the settlement is deleted before
       the `AFTER DELETE` trigger fires, and the FK would reject it), so a
       denied batch would be precisely as ungroupable as it is today. A stamped
       column groups all four types uniformly whether or not the settlement
       still exists, and makes the unread count a distinct-`batch_id` count
       with no embed.
     - All three settlement trigger functions rewritten to stamp it; a
       backfill for existing unread notifications (recovers everything except
       `settlement_denied`, which has no settlement left to read); indexes on
       both columns.
     - `Settlement.batch_id` / `Notification.batch_id` added to
       `types/index.ts`; `docs/schema.md` updated (its `notifications` block
       was also still missing `amount` from `20260805010000`).
   - [ ] ~~**Second trigger migration**~~ — **largely absorbed by the above,
     2026-08-08.** This existed to stop `notify_settlement_confirmed` /
     `notify_settlement_denied` firing `FOR EACH ROW`. With grouping keyed on a
     stamped column they can stay per-row — which is what the (e) fork already
     decided for INSERT — and the client collapses N rows into one card. So (e)
     is still open, but as **client work in `useNotifications`**, not a
     migration. Tracked in "Batch grouping in the notification list" below;
     nothing further is owed on the DB side.
   - [ ] **`useCreateSettlements()`** — plural, alongside `useCreateSettlement`
     in `useSettlements.ts`. Takes an array, does one `.insert([...])`; a
     multi-row Supabase insert compiles to one atomic SQL `INSERT`, so no
     transaction-wrapping RPC is needed. Generates one client-side uuid per
     settle-all action, stamped across the rows. **Status is computed once
     for the whole batch** from the sign of its net, per (a′) — not per
     row, and a batch never mixes. Invalidation must cover the activity
     keys, not just `['settlements', groupId]` — this is the
     `invalidateMoneyData` extraction under Consolidation.
     **Must pass `batch_id` explicitly on every row.** The column default is
     per-row, so relying on it would give each row in a batch a *different*
     uuid — silently splitting one payment into N batches of one rather than
     failing loudly. The default exists for the singular path only.
   - [ ] **Wire both CTAs** — 1 row for the drill-down, N for settle-all — and
     fix the settle-all review screen to show gross per direction *and* the
     net transfer, per (b) as refined by (a′). The CTA currently shows
     `Math.abs(net)` alone.
   - [ ] **Batch grouping in the notification list** per (e) + the fork
     decision — one card per batch, leading with the net transfer. Now also
     carries what the dropped trigger migration was for: group by
     `notifications.batch_id` in `useNotifications`, render one card per batch,
     and change `useConfirmSettlement`/`useDenySettlement` from
     `.eq('id', id)` to `.in('id', ids)`. Symmetric with the write path — one
     statement each way, per-row triggers emit N notifications sharing a
     batch_id, and the client collapses those on the return trip too.
     **Until this lands, denying one row of a batch leaves the rest live** —
     a payee can half-receive a payment, which (d) says is impossible. That's
     the sharpest reason this is the next piece after the migration, not the
     notification noise.
   - [ ] **Unread count query** — doesn't exist yet (`useProfile.ts:120-124`
     says so in a comment). Must count **distinct batches**, not rows, so
     write it after `batch_id` lands rather than retrofitting it. Gated on
     the "Now" §4 surface decision (A: badge the Me tab / B: shared header)
     for *where* it renders, but the query is the same either way.
     **Gotcha:** `notifications.batch_id` is NULL for `group_invite*` types,
     so the count is distinct non-null `batch_id` **plus** rows where it's
     NULL — not a bare `count(distinct batch_id)`, which would collapse every
     pending invite into one.

   ### Phase 3 — close the gaps this flow opens

   - [ ] **Delete a settlement** — now the *only* remedy for a wrongly
     recorded "you paid me," since phase 1 makes that path skip confirmation
     entirely. Needs `useDeleteSettlement` and a UI entry point (settlement
     rows in the group feed aren't tappable at all today, unlike the expense
     rows directly above them). Detail under item 1's "New: delete a
     settlement".
     **Correction 2026-08-08 — the RLS migration this called for is already
     done.** Both this bullet and item 1 claimed "DELETE was never restricted,
     so any active group member can likely delete any settlement." Not true:
     `settlements: parties can delete` is in the baseline schema
     (`20260721000000:805`) and already restricts DELETE to `from_member_id` /
     `to_member_id` — exactly the permission item 1 decided on. The
     `review-todo.md` RLS audit flagging only UPDATE was read as "DELETE is
     open" when it meant "DELETE was already fine." No migration needed; this
     is client work only.
   - [ ] **`buildPeopleFlow` — the sub-cent residue and the `AllSquare` copy**
     (see below). Reduced 2026-08-08: the zero-net person, which was the
     reason this sat in phase 3 rather than later, is now a decision rather
     than a bug — the gate stays. What's left is minor and not gating.
   - [ ] **CLAUDE.md supersession pointer** — still unwritten. Its notification
     type list (`:302-303`) predates `settlement_recorded`, and its
     cross-group section still says settlement is "UI aggregation, not a data
     model change" and that each group "generates its own confirmation
     notification to the payee." (b)–(f) override both.

   **`buildPeopleFlow` (`(dashboard)/page.tsx`) — one decided, one open.**
   Both were filed 2026-08-03 as gaps from gating the dashboard on the *net*
   while (b) settles per group.

   - **The net-zero person: keep the gate. Decided 2026-08-08, not a bug.**
     The loop skips anyone whose net rounds under a cent
     (`if (Math.abs(net) < 0.01) continue`, `:58`), so Apartment +$40 /
     Big Sur −$25 / Dinner −$15 nets to $0 and the person never appears.
     Previously filed as a hole in settle-all's reachability. It isn't:
     - **The per-group balances stay fully settleable** from each group's own
       detail page, which has its own `SettleUpSheet`. What's unreachable is
       only the cross-group *convenience* of doing all three at once. The
       earlier "settle-all is unreachable for them" framing overstated it.
     - **Square on net means no money needs to move.** Owing $40 in one group
       and being owed $40 in another are two independently true statements,
       not a discrepancy to reconcile. Leaving them open and letting future
       expenses accrete against them is normal use — same spirit as "partial
       settlements just work."
     - **Showing the row would create an undefined case in (a′).** Status is
       set by the sign of the batch net; a net-zero settle-all has no sign.
       Keeping the gate means the sign is never zero and (a′) stays total as
       written.
     - **Known consequence, accepted:** `DeleteGroupSheet` and
       `/api/groups/members/remove` both block on non-zero balances, so
       deleting Big Sur or removing the member is blocked by a balance the
       dashboard says doesn't exist. The remedy is settling that group from
       its own page, which works today — a discoverability wrinkle, not a
       dead end.
   - **Cross-group affordance on the group page — declined 2026-08-08, not
     deferred.** Considered: when settling in a group where the counterparty
     has an offsetting balance elsewhere, nudge with "Alex owes you $40 in Big
     Sur — settle both and no money needs to change hands." Framed as
     opportunity rather than warning, and the group-feed privacy objection
     wouldn't have applied (the sheet is your own view of your own balances,
     not the member-visible feed). Dropped because the per-group ledgers are
     already correct — cross-group netting is a convenience that belongs on
     the dashboard, where you've explicitly asked for a person-level view.
     **What this saves in Phase 2:** the sheet stays group-scoped, so
     `Transfer` does *not* need to absorb `groupId`/`mySeatId`, and
     `SettleUpSheet`'s `groupId`/`mySeatId` props stay put. The two settle
     surfaces stay separate — `SettleUpSheet` group-scoped on the group page,
     `BalanceSheet`'s own screens cross-group on the dashboard — and
     `PersonPart` already carries everything the batch write needs. Step 1 is
     just the plural, group-unbound mutation. Revisit only if the sheet ever
     has to express rows in more than one group.
   - [ ] **Still open — sub-cent residue.** `net` sums *all* per-group entries
     while `parts` filters at `>= 0.01`, so the hero can disagree with the
     by-group rows, and settle-all — which iterates `parts` — wouldn't
     strictly zero the person out. Invisible in dollars. Fix by deriving
     `net` from the filtered parts; left alone so far because it changes
     displayed numbers. Independent of the net-zero decision above.
   - [ ] **Still open — `AllSquare` copy.** With one counterparty you're
     net-square with, home renders "All square" while their group still shows
     an open balance to every member of it. Consistent if home is read as
     net-framed, confusing otherwise. Copy-only, blocking nothing.

6. **Activity page — flat recent feed, not keyed by group** 🟡 — **done**
   `/activity` is a single chronological feed (`useAllActivity()`); home rail
   uses `useAllActivity(6)`. Group shows as row metadata via `showGroup`.
   Removed `ActivityGroup` bucketing.

7. **Add-expense entry point in the nav bar** 🟡 — **not started, do not
   implement yet** (logged 2026-08-03). Today add-expense is only reachable
   from inside a group: `groups/[id]/page.tsx`'s triggers and the
   `/groups/[id]/add` route. `TabBar.tsx` has no add button and no FAB, so
   CLAUDE.md's "Tab bar + FAB" navigation model has never actually been
   built — the FAB is the missing half.

   **Design source** — import via the `claude_design` MCP
   (`https://api.anthropic.com/v1/design/mcp`, auth via `/design-login`).
   Same `splitter` project the settle-up and expense-action designs came
   from (`36d6382c-156c-422e-afd2-063025ff0a0f`); the whole project is
   readable.

   Selection:
   <https://claude.ai/design/p/36d6382c-156c-422e-afd2-063025ff0a0f?file=Add+Expense+Full+Flow.html>

   - Primary file: `Add Expense Full Flow.html`
   - Imports it pulls in, all worth reading: `add-expense-flow.jsx`,
     `design-canvas.jsx`, `ios-frame.jsx`, `nav-add-expense.jsx`,
     `tally-shared.jsx`, `tweaks-panel.jsx`

   **Scope:** implement `Add Expense Full Flow.html`, adding an add-expense
   button to the nav bar.

   **Prior art to reuse rather than rebuild** — the form itself already
   exists and is sheet-ready: `AddExpenseForm.tsx` plus
   `add-expense/MobilePanel.tsx` / `DesktopPanel.tsx`, already driven by
   `ModalOrSheet` and local `addExpenseOpen` state on the group page. The
   open question this design has to answer is group selection: every
   existing entry point already knows its group, but a nav-level button
   doesn't — CLAUDE.md's FAB spec says "pick existing group or create new"
   before the form. Check what the design does here before building.

   **Scope note:** `design-canvas.jsx`, `ios-frame.jsx` and
   `tweaks-panel.jsx` are the design project's own harness (canvas chrome,
   phone frame, live-tweak controls), not app surface — read them to
   interpret the mockup, don't port them. Same call made for the
   `ExpenseActionSheet` import under Desktop §19e.

8. **Mobile presentation pass — sheets and app chrome** 🟡 (2026-08-03, Matthew's
   observations; the pointers below are where to start looking, not diagnoses)
   - **Settle drawer sizing.** The settle sheet is content-sized while
     add-expense is not: `globals.css` gives `.tally-sheet-content` a
     `max-height: calc(100dvh - 40px)`, but only
     `.tally-sheet-content.add-expense-panel-root` also pins a fixed `height`.
     So the settle sheet grows and shrinks as it swaps between its list and
     record-payment screens instead of holding one height. Either give the
     settle root the same treatment, or make fixed-height the default for
     multi-screen sheets.
   - **App background doesn't cover the full screen on mobile.** `body` gets
     `var(--tally-page-bg)` under `html, body { height: 100% }`. `100%` doesn't
     track the visual viewport as mobile browser chrome collapses — likely wants
     `min-height: 100dvh`, and/or the mesh-gradient blobs moved onto a
     fixed-position layer so they don't scroll away from the fold.
   - **Drop the header/footer rules.** The hairlines read as heavy on mobile:
     `.home-topbar`'s inline `borderBottom` (`(dashboard)/page.tsx`), the group
     detail topbar and header band (`groups/[id]/page.tsx`), and the
     add-expense desktop footer. Decide whether they go everywhere or only
     below the mobile breakpoint.
     **Sequencing note:** if "Now" §4 option B lands (shared mobile app header
     with a notifications slot), do that *first* — it replaces three header
     patterns with one, and this becomes a single rule change instead of four.
     Also worth knowing here: Groups and Activity have no header at all, so
     their titles scroll out of view. Option B fixes that too.

9. **Settlement notification semantics** 🟡 — two related problems, both
   trigger/schema territory, both worth settling *before* item 5 wires up the
   settle-all write.
   - **[bug] Recording money owed *to* you notifies the wrong person** —
     **DB half fixed 2026-08-05, client half is item 5 phase 1.**
     `notify_settlement_created` notified `to_member_id`'s profile
     unconditionally, so marking "Sam paid me" (from=Sam, to=me) sent **me** a
     "Sam says they paid you — confirm?" about a row I had just written myself,
     and Sam was told nothing. Now branches on `NEW.status` and sends the payer
     an informational `settlement_recorded` on the creditor-recorded path — the
     new constraint value proposed here, adopted.
     **The `settlements.recorded_by` column proposed above was not built and
     is not needed**: (a′) makes status itself the carrier of who recorded it,
     uniform across a batch. Still reachable today from `SettleUpSheet`'s
     "Owed to you" section until phase 1 lands, because
     `useCreateSettlement` still inserts `pending` unconditionally.
   - **[question] "Settle all with X" fans out one notification per group** —
     **resolved**; superseded by item 5 (c)+(e). Of the three options weighed
     here, the first won: keep N settlement rows, correlate them with a
     `batch_id`, render one card per batch. The join-table variant was rejected
     on the read path (a notification pointing at N settlements can't use
     `notifications.settlement_id`, and `batch_id` isn't unique so it can't be
     FK'd either — PostgREST embedding at `useProfile.ts:130` would break), and
     pure UI grouping was rejected as inferring the action boundary rather than
     recording it. Grouping is client-side by `batch_id`; triggers stay
     per-row. The `CLAUDE.md` amendment this bullet anticipated is item 5
     phase 3's supersession pointer.

10. **Post-settlement confirmation screen** 🟢 — after completing a settlement,
    show a brief success state instead of just closing the sheet — "Settled $X
    with [Name]." Today `SettleUpSheet.handleConfirm` (`SettleUpSheet.tsx:181-193`)
    calls `handleClose()` immediately on mutation success with no acknowledgment
    at all; you tap confirm and the sheet just vanishes.
    - **Design reference already exists, previously deferred.** Item 1 flagged
      `SFPaymentSent`/`SFSettlementConfirmed` — full-screen success states in
      `Settle Up Flow.html` (`splitter` claude.ai/design project,
      `36d6382c-156c-422e-afd2-063025ff0a0f`) — as "out of scope for this item."
      This is that work, picked back up.
    - **Scope:** a third `Screen` state in `SettleUpSheet`
      (`'list' | 'record-payment' | 'success'`), shown after `handleConfirm`'s
      `mutateAsync` resolves, before the sheet closes. Check the design for
      auto-dismiss vs. tap-to-close. Copy should read fine for both directions
      given item 5(a)'s pending/confirmed split — "Settled $X with [Name]" works
      either way; only diverge if the design itself differentiates paid vs.
      marked-as-paid.
    - **Independent of item 5's batch model** — this covers the single-transfer
      `SettleUpSheet` path and can ship on its own. Settle-all (once item 5
      phase 2 lands) will eventually want its own summary screen ("Settled $50
      across 2 groups with Alex") — note it here so it isn't rediscovered as a
      gap, but don't scope it now.

11. **Code review** — run `/code-review` (or `/code-review ultra` for the deeper
    multi-agent pass) once 1–10 are done, before calling it shippable.

12. **Bounded rail — merge notifications + activity in the home rail** 🟡
    *(logged 2026-08-05, not started — scoped only this session)* — cap the
    "needs attention" module and fix its recent-activity preview to a real
    fixed size, so notifications can never push activity down.

    **Design source** — `claude_design` MCP, same `splitter` project
    (`36d6382c-156c-422e-afd2-063025ff0a0f`):
    <https://claude.ai/design/p/36d6382c-156c-422e-afd2-063025ff0a0f?file=Feed+Notifications+Merge.html>
    — top section, "Recommended — bounded rail (capped Attention + fixed
    Activity)" (`FNBoundedDash`/`FNBoundedRail`/`FNAttnRow`/`FNPreviewRow`/
    `FNReviewModal` in `feed-notif-merge.jsx`). The file's four earlier
    unbounded merge directions (stacked/tabbed/unified/priority) are kept
    for comparison only, not in scope.

    **Current state is closer to this than it looks** — `NeedsAttentionRail`
    (`(dashboard)/page.tsx` ~L376–427) already has the two-module shape
    (needs-attention + recent activity via `useAllActivity(6)`, already a
    fixed-count non-scrolling preview). What's missing:
    - **No cap** — `actionable` renders every matching notification inline,
      unbounded. Needs: slice to 2 + a "+N more" overflow row/button.
    - **Confirm/deny/accept/decline happen inline** via `GroupInviteCard.tsx` /
      `SettlementConfirmCard.tsx`'s own buttons calling
      `useConfirmSettlement`/`useDenySettlement`
      (`useSettlements.ts`)/`useAcceptGroupInvite`/`useDeclineGroupInvite`
      (`useMembers.ts`) directly. The design's `FNAttnRow` is a denser row
      whose button opens a **review modal** instead — the mutation call
      moves there. No new mutations needed, just relocating the call sites.
      Build the modal on the existing `src/components/modal/` `ModalOrSheet`
      system, same local `useState<Item | null>` open/close pattern as
      `ExpenseActionSheet`/`home/BalanceSheet.tsx`.
    - **Activity limit** — drop `useAllActivity(6)` → `(5)` to match the
      design's fixed 5-row preview. `useAllActivity(limit)` already supports
      this (its own comment calls out "home recent rail" as the intended
      use case) — no data-layer change.
    - No `Notification` type change, no new queries — `useNotifications()`
      (`useProfile.ts`) is already unread-only; capping is client-side.

    **Overlaps with "Now" §4** ("Where notifications live — decide before
    building") — that item's Option B (shared header + global
    `NotificationsSheet`) would make the home rail a secondary "while
    you're here" nudge rather than the primary inbox. Decide relative
    priority/sequencing against that before building this, not after.

    **Also needs: update the skeleton loaders.** `HomeScreenSkeleton.tsx`
    has no skeleton for the rail at all — `NeedsAttentionRail`'s loading
    state today is a bare `"Loading…"` text stub (`page.tsx:413`), not the
    `Bone`/`CardShell` pattern the rest of the home skeleton uses
    (`HeroSkeleton`/`GroupsSkeleton`/`ActivitySkeleton` in
    `HomeScreenSkeleton.tsx`). Once the rail's row count/shape changes here
    (capped attention rows, 5-row preview), add a matching bone skeleton for
    both modules so loading doesn't visually jump when data arrives.

---

## Now — in priority order

Thread: correctness → abuse protection → small visible wins → big flows.
Steps 1–4 ≈ two solid sessions and the app is safe to hand to real users.

### 1. Ship the decline fix — done

- [x] **Applied `20260711000000_decline_to_guest.sql` to the cloud project**
  (2026-07-11). Full decline flow live: no-history declines delete the row,
  declines-with-history convert the seat to a guest, inviter gets the correct
  `group_invite_declined` notification either way.

### 2. Bug sweep 🟢 — done

- [x] **Invisible notifications** — `group_invite_accepted`/`declined` added
  to the `Notification` union; Me page now whitelists info types
  (`INFO_TYPES`), renders per-type labels, and auto-marks them read on view
  (`useMarkNotificationsRead`, no invalidation so rows don't vanish
  mid-read). Also fixed en passant: the old `type !== 'settlement_confirm'`
  filter rendered pending `group_invite` rows a second time as
  "✗ Payment denied · $0.00".
- [x] **`ExpenseActionSheet` split header** — now branches on `split_type`
  (equally · $X each / exact amounts / percentage / items).
- [x] **Deleted `src/lib/mockData.ts`**.
- [x] **Silent add-member failure** — `handleAddMembers`
  (`groups/[id]/page.tsx`) had a `try { } finally { }` with no `catch`; any
  failure (network, validation, or the new 429 from rate limiting) became
  an unhandled rejection with zero user feedback. Added `addError` state,
  surfaced in both the desktop and mobile add-member panels, parsed from
  the route's `{ error }` body when present.
- [x] **Dead code removed** (2026-07-13) — `AddMemberModal`,
  `NewGroupModal`, `BalanceBreakdownModal`, `AmountDisplay`, `AppShell`,
  `useAddGroupMember`, and a `DROP FUNCTION` migration for the stale
  `create_group_with_members` RPC (needs `db push`). Details under
  Consolidation.

### 3. Rate limiting 🟢 (implementation) / 🟡 (sign off on the numbers)

**Approach (decided): count recent rows in existing tables — no new vendor,
no new table.** The DB already records who did what when (`groups.created_by`
+ `created_at`, `group_members.invited_by` + `joined_at`). A small helper
queries the count in the window with the service-role client and the route
returns 429 over the limit. Racy at the margin (two concurrent requests can
both pass) — acceptable slop for rate limiting. Serverless-safe because state
lives in Postgres, not instance memory. Limits are set ~10x above honest
usage: they cap worst-case damage, not shape behavior. Log 429s, tune later.

- [x] `src/lib/rateLimit.ts` — written, **not yet wired into any route**.
  One function: `isOverLimit(admin, source, identifier, limit, windowMs)`.
  `source` (`{ table, userCol, timeCol }`) is a plain parameter, not a
  per-action wrapper — no `groupCreateLimiter`/`memberInviteLimiter`
  ceremony. Counts existing domain rows, fail-open, logs `[rate-limit]`
  lines. Swapping the source of truth (Postgres → Redis/Upstash later)
  means a differently-shaped `isOverLimit` with the same
  `(identifier, limit, windowMs)` call convention — callers switch which
  function they import, nothing else changes.
- [x] **Wired `/api/groups/create`** — 10/hr via `created_by`/`created_at`;
  429 + `Retry-After: 3600` when hit.
- [x] **Wired `/api/groups/members/add`** — 30/hr via `invited_by`/
  `joined_at`. Guest inserts originally had `invited_by NULL` and bypassed
  the limiter entirely; fixed 2026-07-19 (`605bf24`) to set `invited_by` on
  guest rows too, so the limit covers the whole insert surface. 429 +
  `Retry-After: 3600` when hit.
- [ ] **`/api/invite/decline`** — no limiter needed: requires an existing
  pending membership, so it's self-limiting.
- [x] **Search debounce** — new shared `useDebouncedValue` hook
  (`src/hooks/useDebouncedValue.ts`); `AddMemberModal` now debounces at
  250ms before hitting `useSearchProfiles` (was firing on every keystroke).
  `MemberCombobox` already had its own inline 250ms debounce — deduped onto
  the shared hook. `useSearchProfiles` also got `placeholderData:
  keepPreviousData` so results don't flash empty between ticks. The
  `useMemberSearch` extraction (Backlog → Hooks) is still open — this just
  fixed the debounce gap, didn't do the full hook extraction.
- [ ] **Supabase auth limits** 🟡 — dashboard review only (built-in), no
  code. Tally is Google-OAuth-only, so the email-based limits (magic
  link/password reset) don't apply — the one worth checking is the
  sign-in/session rate cap, in case a burst of invite-driven signups (e.g.
  everyone in a group joining around the same time) would hit it.

**Known limitation (accept for MVP):** expense/settlement writes go client →
PostgREST directly with the user's JWT, bypassing Next entirely — nothing at
the app edge can limit them, and profile search is likewise callable directly.
RLS bounds the blast radius to the user's own groups. Real enforcement means
moving writes behind API routes or DB-side counters — revisit only with
evidence of abuse. `/api/ocr` (Phase 3) must launch with a limiter (same
counting pattern against an OCR-requests log; ~20/day per user — it burns
real compute).

### 4. Small wins: notification surface + app-level prefetch 🟡

Notification count **depends on step 2** — ship it first or the count is
permanently wrong. Also depends on the settlement-notification fix (punch list
item 9): a count is only useful once notifications reach the right person.

- [ ] **Where notifications live — decide before building** 🟡 *(discussed
  2026-08-03; supersedes the old "unread count badge on nav bell" line, which
  described a nav that was never built)*

  **There is no bell icon in the app.** `TabBar.tsx` and `Sidebar.tsx` both
  render the same four items — Home · Groups · Activity · Me — and notifications
  live inside `/me`, stacked above the profile editor. So the badge would land
  on the **Me tab**, which reads as "something is wrong with your account"
  rather than "Sam is waiting on you."

  Compounding it, the same content is currently in three places: home's
  `NeedsAttentionRail` (actionable only), `/me` (actionable + info), and
  passively in `/activity`. No surface owns it.

  **Option A — badge the Me tab. ~1h.** `TabBar.tsx` already has the full
  render path: `WebNavBadge` imported, `NAV_BADGES` slot at line 19 (a
  hardcoded empty object), both dot and number variants handled. So mobile is
  "write the count query, feed the object." `Sidebar.tsx` has no badge slot, so
  desktop needs one. Cheap, works, semantically muddy.

  **Option B — global notification icon in a shared header. 4–6h. Preferred.**
  A persistent top-right icon on every page, opening a `NotificationsSheet`
  via `ModalOrSheet` (bottom sheet on mobile, modal on desktop, same primitive
  as everything else). The blocker is that **there is no shared header to put
  it in**:

  | Route | Mobile header today |
  |---|---|
  | Home | `.home-topbar` — sticky, greeting + New group + avatar |
  | Groups | none — in-content title + button, scrolls away |
  | Activity | none — in-content title, scrolls away |
  | Me | none — avatar sits in content |
  | Group detail | bespoke — back + name + settings gear |

  Three patterns, and `(dashboard)/layout.tsx` provides sidebar + tab bar +
  mode sheet but no header. So B means extracting a shared mobile app header
  (title slot + per-page actions slot + fixed notifications slot) into the
  dashboard layout and migrating five routes onto it.

  That's worth doing on its own merits: titles currently scroll out of view on
  Groups and Activity, and punch-list item 8 already wants to rework header
  treatment — so the header gets touched either way. B absorbs part of item 8
  rather than adding to it.

  It also resolves the three-places problem: the sheet becomes **the** inbox,
  `/activity` goes back to pure history, and the home rail becomes an optional
  "while you're here" nudge rather than the primary surface.

  Rough split for B: shared header extraction 2–3h (five routes), notifications
  sheet ~1h (`GroupInviteCard` / `SettlementConfirmCard` already exist and are
  already shared between home and `/me`), count query ~30m, desktop placement
  ~1h. Desktop is less urgent — the sidebar is persistent and never scrolls away.

  **Recommendation: B, but scheduled after the P0 work** (see
  `docs/publish-roadmap.md`). It's the largest P1 item and touches every
  dashboard route. If launch timing gets tight, A buys most of the signal for
  an hour and can be upgraded to B later — the count query is the same either
  way.

- [ ] **Unread count query** (needed by both options) — single int,
  `refetchInterval: 30_000`, `refetchIntervalInBackground: false` (per
  CLAUDE.md sync rules). Note punch-list item 9: if cross-group settlements
  get batched, this must count **distinct batches**, not rows.
- [ ] **App-level data prefetch** — `useGlobalBalances` only runs on the home
  page, so deep-linked pages lack cross-group balance data (avatar taps on
  the group detail balance card have nothing to show):
  - [ ] `src/components/GlobalDataPrefetch.tsx` — calls `useCurrentProfile`
    + `useGlobalBalances` once on app load
  - [ ] Mount inside `<Providers>` in `src/app/layout.tsx`
  - [ ] Wire avatar tap in group detail balance card expanded rows →
    `PersonProfileSheet` using cached global balances

### 5. Group settings + leave group — mostly done (shipped `group-settings` branch, PR #1, 2026-07)

Creator (`created_by`) is the admin.

- [x] **Route** — `src/app/(dashboard)/groups/[id]/settings/page.tsx`
- [x] **Rename group** — name + emoji picker (`EmojiPickerSheet`)
- [x] **Member management (remove)** — admin removes active members
  (`useRemoveMember` → `/api/groups/members/remove`, sets `status: 'left'`,
  server-side blocks removal while the member has an unsettled balance)
- [x] **Leave group** — non-admin: `status: 'left'` via `useLeaveGroup`,
  tap-to-confirm in the danger zone
- [x] **Delete group** — admin only, `DeleteGroupSheet` blocks while any
  member's balance is non-zero
- [x] **Group settings entry point** — 2026-07-26: `GroupActionMenu` (the
  ellipsis bottom-sheet with Group settings/Add member/Leave group/Delete
  group items) deleted. Both its trigger buttons on group detail now go
  straight to `/groups/[id]/settings` via a settings-gear icon — no menu
  step. Safe because every other item was already redundant or reachable
  elsewhere: "Leave group" just routed to settings anyway; "Add member"
  has its own independent triggers on the group detail page unrelated to
  the menu; "Delete group" is still fully available via the settings
  page's own danger zone (one extra tap instead of a group-detail
  shortcut). Also drops `GroupActionMenu` out of consolidation pass 2's
  #3 (`review-todo.md`) — only `DeleteGroupSheet` and `ExpenseActionSheet`
  still hand-roll their own sheet chrome now.
- [ ] **Invite link** — show + copy + regenerate `invite_token`. Not built
  anywhere: the token exists on `groups` and `/invite/:token` accepts it,
  but no UI surfaces it, so link-based invites are currently dead — the only
  way to add someone today is `MemberCombobox` search/QR/guest.
- [ ] **Cancel pending invite** — pending members render as a static
  read-only row in settings (no tap handler); need a DELETE path (safe only
  while the pending row has no splits — reuse the decline route's history
  check) and to wire it into `MemberActionSheet` or a dedicated action for
  pending rows.

### 6. Expense editing — remaining

- [ ] **Edit history drawer** 🟡 (light — needs a look at the sheet design) —
  tap "(edited)" → sheet listing `expense_history` snapshots (edited_by name,
  date, old amount/description). Needs a read hook.
- [ ] **Split editing** 🟡 — edit drawer keeps split membership read-only;
  editing who's in the split / split mode means re-running the full split
  builder (reuse `AddExpenseForm` machinery)

### 7. Itemized splits 🟡 (schema + UX design)

`equal`, `exact`, `percentage` shipped (running remainder counters included).

- [ ] `itemized` — line items assigned to members, tax/tip distributed
  proportionally. Requires `expense_items` + `expense_item_assignments` tables
  (not yet created). Mobile builder UI exists as a non-saving preview in
  `AddExpenseForm`. Phase 3 receipt scanning pre-fills this flow.

---

## Prod readiness (from 2026-07-11 codebase audit)

- [x] **Audit RLS coverage + capture a baseline migration** — done
  2026-07-19/21. RLS audit (`docs/review-todo.md`) found and fixed two
  critical gaps (`group_members` UPDATE, `expense_splits` DELETE) plus a
  followup tightening bundle (`605bf24`: `get_my_group_ids()` status
  filter, self-only `group_members` INSERT, dropped client DELETE,
  payee-only settlement confirm). Baseline migration squashed 2026-07-21
  (`482424b`) — one replayable schema dump, `db reset`/`db pull --linked`
  now match prod with zero drift.
- [x] **Switch API routes from `getSession()` to `getUser()`** — done
  2026-07-19, commit `605bf24`. All three routes call
  `supabase.auth.getUser()`.
- [x] **Global mutation error surface** — done 2026-08-02. `providers.tsx`'s
  `QueryClient` now takes a `MutationCache` with a global `onError` — pushes
  a toast (message from the thrown `Error`, or a generic fallback) regardless
  of whether the mutation has its own local `onError` too, so all 7 previously
  unguarded `mutateAsync` sites (`groups/new`, `me`, `useAddExpenseForm`,
  `DeleteGroupSheet`, `ExpenseActionSheet` ×2, `SettleUpSheet`) get feedback
  for free with zero per-site changes. Toast state lives in the existing
  `useUIStore` (Zustand) as a `toasts` queue + `pushToast`/`dismissToast`;
  `src/components/Toast.tsx` renders the stack (bottom-centered, dark card,
  coral accent dot, auto-dismiss 5s or tap), mounted once in `Providers`.
  Root `src/app/error.tsx` added for render-time errors (client component,
  `reset()` + a link home). Verified live: built a throwaway public test
  route, drove it with Playwright (fetched via npx — not a project
  dependency), confirmed the stack renders, stacks, and auto-dismisses with
  zero console errors, then deleted the scratch route. Typecheck + full
  build + 45/45 tests clean.
- [x] **Unchecked Supabase errors — audited + fixed 2026-08-08.** Follow-on
  from the global error surface above, which couldn't help at any of these
  sites because none of them threw. PostgREST returns failures in `error`
  rather than throwing, so an unchecked call resolves as success and the UI
  reports the action as done. All 56 `.from(` call sites reviewed; ~15 already
  did `if (error) throw error` and were left alone.
  - **The toast never showed the real message.** `providers.tsx`'s
    `MutationCache.onError` tested `error instanceof Error`, but a
    `PostgrestError` is a plain object — so every existing `throw error` site
    fell through to the generic "Something went wrong." Now reads `.message`
    off anything carrying one. One-line fix, lifts all sites at once.
  - **`useAcceptGroupInvite`** — worst of the set. Membership UPDATE and
    notification read-marking ran as an unchecked `Promise.all`: a rejected
    join still retired the invite card, and since `useNotifications` is
    unread-only, the invitee was left never having joined with no way left to
    accept. Now sequential and checked, including a zero-rows-matched guard
    (seat no longer pending ⇒ not an acceptance, don't retire the card).
  - **`useConfirmSettlement` / `useDenySettlement` / `useDeclineGroupInvite`** —
    same `Promise.all` shape, same fix. Deny's swallowed error is why the FK
    bug above went unnoticed from the day it was written: the `23503` came
    back in `error` and the client dropped it.
  - **`invite/[token]` `handleAccept`** — two bare `await`s then `router.push`
    regardless; a rejected join dropped you on a group page you aren't a member
    of, where RLS returns nothing and it reads as an empty group. Now surfaces
    the error and stays put. Also fixed a stuck `submitting` on the no-session
    early return.
  - **Two fail-open guards** (both failed open in exactly the case they exist
    for): `/api/groups/members/remove` coalesced failed expense/settlement
    queries to `[]`, computing a $0 net and waving through removal of a member
    who owes money; `HandleInput`'s availability check read a failed lookup as
    'available', green-lighting a taken handle that then dies on the UNIQUE
    constraint. The latter got a new `HandleState` value, `'error'` — both
    consumers gate on `=== 'available'`, so it blocks submission for free.
  - Smaller: `/api/groups/create`'s compensating delete now logs if the
    rollback itself fails (orphaned group is otherwise only findable in the
    DB); `/api/groups/members/add`'s caller lookup no longer reports "not a
    member" to a member when the lookup errored; `useRecentCollaborators`
    throws instead of rendering a failure as "no recent people."
- [ ] **Generated Supabase types** 🟡 (needs linked-project login) —
  `types/index.ts` is handwritten and has already drifted (Notification
  union). `npx supabase gen types typescript --linked > src/types/supabase.ts`,
  then chip away at the 17 `as any` casts.
- [ ] **CI** 🟢 — no `.github/workflows`. Add typecheck + test + build on
  push/PR; the vitest suite exists now so this pays immediately.
- [ ] **`import 'server-only'` in `src/lib/supabase-server.ts`** 🟢 — build-time
  guard so the service-role module can never be pulled into a client bundle.

### Polish / small fixes

- [x] **Display name editing** — shipped: Me page edits `display_name` +
  `handle` with dirty-checking and save via `useUpdateProfile`.
- [ ] **Home page layout** 🟡 — desktop multi-column layout differs from the
  `DashboardPage` wrapper used elsewhere; consider aligning (see Desktop)
- [ ] **Balance cards expand button** 🟡 — modal with full per-person
  breakdown (who owes what, across which groups)
- [ ] 🟢 **Money display must be exact — stop dropping cents** (decided
  2026-08-05, fix later). Three treatments coexist on one card:
  `BalanceTable.tsx:90` floors the row amount, `:115` renders the
  breakdown beneath it with full cents, `:69` *rounds* the column header
  (`toFixed(0)`). $30.80 reads $30 / $30.80 / $31 top to bottom, so the
  header can exceed the row it sums. Home repeats it —
  `(dashboard)/page.tsx:172` truncates the gross figures under a net
  rendered with cents at `:159-162`. **Decision: always show the cents.**
  The floors are half-ported `<Money>` anatomy (`BalanceBadge.tsx:29-30`
  has the correct whole + padded-cents version); the math-layer
  `Math.round(x*100)/100` is unrelated and stays. Full write-up in
  `docs/review-todo.md` #6.

### Desktop / web layout — remaining

Sidebar/tab-bar responsive split is done (breakpoint 1024px, `dashboard.css`).
Group detail 2-column layout (§19) shipped.

- [ ] **Home dashboard 3-column layout** 🟡 — reference `home-overview.jsx` in
  the design project. Left 340px: compact balance hero + groups mini-list;
  middle flex: recent activity; right 285px: per-person "Up Next" owe/owed
  action cards. Single column below 1024px. All data already fetched —
  layout + rendering task only. (Full column-by-column spec lived in TODO
  §18 — see git history if needed.)
- [x] **Modal sizing audit** 🟢 — done 2026-07-26 as part of §19e below.
  `DeleteGroupSheet` and `ExpenseActionSheet` were the only stragglers not
  on `ModalOrSheet`; both migrated. Every sheet in the app now goes through
  the shared primitive.
- [x] **19e** 🟢 — done 2026-07-26: `ExpenseActionSheet` migrated from its
  hand-rolled `createPortal`/backdrop/slide-up to `ModalOrSheet` — Vaul
  bottom sheet with drag-to-dismiss on mobile, centered ~460px modal on
  desktop. Built from the "Desktop A — faithful port" direction explored
  in the `splitter` design project (`Expense Action Desktop.html` /
  `expense-action-desktop.jsx`): same three screens (actions/edit/delete)
  stacked the way they read on mobile, just wider and calmer, using the
  `EmojiTile`/`SectionLabel`/`formatAmount` atoms already built this
  session. Scoped down from the design reference: kept the existing plain
  `formatAmount()` text instead of adopting the design's fuller
  sign+$-at-half-opacity/big-number/mono-cents amount lockup — that's the
  deferred `<Money>` hero component (see `review-todo.md` #6), out of
  scope for a chrome migration. Typecheck + production build clean; not
  yet exercised live in a browser.
- [x] **19f** — wire group action menu items (done alongside "Now" step 5;
  settings still needs the desktop layout pass noted above)

### Consolidation / dead code (from 2026-07-13 duplication audit)

**Dead code — deleted 2026-07-13** (all recoverable from git history):
- [x] `AddMemberModal.tsx` (496) + `useAddGroupMember` — deleted. If the
  richer add-member UX (QR / invite-link / recents in one dialog) is wanted
  later, resurrect from git or rebuild on `MemberCombobox`.
- [x] `NewGroupModal.tsx` (132) — deleted; `groups/new/page.tsx` is the one
  create path.
- [x] `BalanceBreakdownModal.tsx` (111) — deleted. Note for the "balance
  cards expand" polish item: this was a per-person breakdown modal —
  resurrect from git if it fits rather than rebuilding.
- [x] `AppShell.tsx` (14) — deleted.
- [x] `AmountDisplay.tsx` (48) — deleted. If the style-guide money anatomy
  is ever enforced app-wide, rebuild it then and migrate the ~40 inline
  `toFixed(2)` call sites in one sweep.
- [x] `create_group_with_members` RPC —
  `20260713000000_drop_stale_group_rpc.sql` written; **needs
  `npx supabase db push`** to take effect in prod.

**Logic implemented more than once:**
- [ ] 🟢 **Balance math ×3** — `lib/balance.ts` (tested), `useGlobalBalances`
  (reimplements nets/pairwise/gross inline, 292 lines), and group detail
  `page.tsx` (inline pairwise nets). **Design settled — see "Shared balance
  core" in `docs/review-todo.md`** (calcPairwiseNets + summarizeBalances,
  seat-space core, identity fold in the hook). Decided worth doing
  2026-07-13; build on request.
- [ ] 🟡 **Avatar slot color — two conventions, and they're not interchangeable**
  — *rewritten 2026-08-02; the earlier "just migrate everything to index-based"
  direction was wrong and would have broken call sites.*
  - **`slotFor` half: done.** Exported once from `lib/memberDisplay.ts`; the 3
    index-based copies (group detail, settle, `ExpenseActionSheet`) are deleted.
    The settle copy went with the route.
  - **`hashSlot` half: still 3 copies** — `(dashboard)/page.tsx:26`,
    `MemberCombobox.tsx:23`, `SuggestedMembers.tsx`. Two of the original 5 went
    away with `AddMemberModal`/`BalanceBreakdownModal`, not by migration.
  - **Why they can't just be merged:** `slotFor(members, id)` needs a member
    array to take a position in. The remaining `hashSlot` sites don't have one —
    `MemberCombobox:52,178` and `SuggestedMembers:57,119` render *search results
    and suggestions* (people not yet in any group), and `buildPeopleFlow`
    (`page.tsx:78`) builds *cross-group* people, where no single group's member
    list applies. `hashSlot` is the correct function at all three. Forcing
    index-based there means fabricating a member array.
  - **The actual open question** (product, hence 🟡): a person shows one colour
    inside a group and a different one on home/search. Fixing that means going
    hash-only everywhere and giving up position-stable colours within a group —
    or accepting the split and documenting the rule (`slotFor` inside a group,
    `hashSlot` for context-free lists). Either way, export the chosen helper(s)
    from `lib/memberDisplay.ts` and delete the 3 local `hashSlot` copies.
- [ ] 🟢 **Display-name fallback** — `lib/memberDisplay.ts` exists but 10
  files still inline `display_name ?? name` (mostly on `ProfileSnippet`,
  which the helper doesn't accept). Add a profile-shaped overload and
  migrate call sites.
- [ ] 🟢 **Invalidation key lists** — the same 5-key invalidation block
  (`expenses`, `settlements`, `global-balances`, `recent-activity`,
  `all-activity`) is copy-pasted across `useExpenses`/`useSettlements`
  mutations. Extract an `invalidateMoneyData(qc, groupId)` helper so a new
  aggregate key can't be forgotten in one of five places.
- [ ] 🟢 **Mobile/desktop duplicate add-member JSX** in group detail —
  two hand-written copies of the same panel; extract one component.
- [ ] Modal system fragmentation — already tracked (Desktop → modal sizing
  audit + review checklist Phase 6).

### Hooks extraction 🟢

Extract business logic from fat components into `src/hooks/`. Components keep
JSX, event wiring, presentational state; hooks own queries, mutations, derived
values, form state.

**Conventions** (settled in an earlier review — the old architecture doc was
removed):
- Navigation via `onSuccess` callback — never `next/navigation` inside a hook
- Never write to `notifications` in a hook — DB triggers own all inserts
- `queries/` = raw fetch/mutate hooks; `hooks/` = composition with local state
- `category` is `useState` seeded from `detectCategory` (user can override),
  not a pure derived value
- Extract only where there's real form/interaction state or genuine reuse;
  otherwise call query hooks directly and `useMemo` derived values

**Worth extracting:**
- [ ] `useAddExpense` — the split-building + category logic in `AddExpenseForm`
- [ ] `useSettleUp` — pre-fill from debt simplification, validation
- [ ] `useCreateGroup` — name/emoji form state + mutation
- [ ] `useMemberSearch` — debounce, three input modes, query gating (folded
  into "Now" step 3)

**Skip:** `useGroupsList`, `useHome` — pure query composition with no second
consumer.
- [x] **`useGroupDetail`** — done 2026-07-31, contrary to the "skip" call
  above: turned out to have 3 identical-shape consumers already
  (`groups/[id]/page.tsx`, `settings/page.tsx`, `settle/page.tsx`), each
  duplicating the same `useGroup`+`useGroupMembers`+`useExpenses`+
  `useSettlements`+`useCurrentProfile` bundle verbatim. Thin composite in
  `src/queries/useGroupDetail.ts` — calls the existing per-resource hooks and
  returns them bundled, each keeping its own queryKey (not a merged query),
  so mutation invalidation and `useAllGroupData`'s fan-out are unaffected.
  `AddExpenseForm.tsx` intentionally left on individual hooks — its two call
  sites use different subsets and would otherwise fetch expenses/settlements
  they never read.

### Later (Phase 2+/3)

- Public expense share page (`/expense/[share_token]`) — skeleton exists,
  needs service-role fetch
- Guest claim flow (`claim_token`, email match, manual link)
- "Former member" display for left members
- Receipt scanning / OCR (`/api/ocr`) — Phase 3, feeds `itemized`
- Expense reactions, group leaderboards
- Email notifications, dark-mode toggle surface, PWA/offline
