# Just Me Budget Design

**Plan, not as-built.** Nothing here is built: no schema change, query, or UI
exists yet. Written 2026-11-03 from the `Just Me Budget.html` mockup in the
`splitter` Claude Design project
(https://claude.ai/design/p/36d6382c-156c-422e-afd2-063025ff0a0f). Standalone
Claude Design closes by December 14, 2026, so anything needed from the mockup
should be captured here or exported before then.

## The Problem

Tally tracks what people owe each other, not what they spend. Someone who wants
to know "how much did I spend this month, and am I on track?" has to work it out
across groups, and has nowhere to log costs that were never shared.

Just me is a private page for that: a monthly spending cap, optional limits per
category, and a view of the month so far.

---

## What the Design Shows

A private space pinned above "Your groups" in the sidebar, marked with a lock.

- **Monthly summary.** Amount spent against the cap, what's left, and "about $X a
  day for N days". A progress bar has a "Today" marker, so being ahead of pace is
  visible at a glance.
- **Categories.** Those with a limit come first, sorted by how much of the limit
  is used. Those without a limit are listed separately and still count toward the
  cap.
- **Category detail.** Running-total chart for the month, a limit on/off toggle
  with an editable amount, and that category's expenses.
- **Nudges.** A category over its limit offers to move money from one with room
  ("Move $20 from Groceries"). Going past the cap stays gentle ("Nothing breaks,
  and November starts fresh") and can suggest a more realistic limit.
- **Add expense.** A modal with a live message showing the effect before saving,
  such as "Puts Food & drink $12 over".
- **Edit budget.** Set the cap and category limits, and see how much of the cap
  isn't assigned to a limit.
- **Recent list.** The latest expenses, in a right-hand column.

The mockup is desktop-only and dark-themed. Build it with the app's theme tokens
rather than its hard-coded colours.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Personal expense storage | Separate tables, private to the owner through RLS | A hidden solo group would make every balance, feed, invite, and group-list query responsible for excluding it. Separate tables keep personal expenses out by construction. |
| Categories | The app's existing 7 (`src/lib/categories.ts`) | Keeps `detectCategory` and matches group expenses, which also feed this page. The mockup's 8 are not used, so its Shopping, Health, and Bills have no category of their own. |
| Recurring charges | Not in the first version | Expenses are added by hand. See [Out of the First Version](#out-of-the-first-version). |
| Group expenses | Your share counts, and can be filtered out | See below. This replaces the mockup, which excludes group expenses entirely. |

---

## Group Expenses

### Count your share, not what you paid

If you pay for a $200 dinner and your share is $50, $50 counts against your
budget. The other $150 is money you're owed, not spending.

Settlements never count. Paying someone back settles a debt for spending that was
already counted, so counting it too would count the same dinner twice.

Group shares are read from existing group data when the page loads. Nothing is
copied into the personal tables, and nothing here feeds a balance. Only live
expenses count (`deleted_at IS NULL`), and a group expense you're not part of
contributes nothing.

### Show them separately

- **Summary:** a breakdown such as "$612 spent: $430 yours, $182 from groups".
- **Expense rows:** tagged with the group's name, and read-only here. Edits happen
  in the group.
- **Categories:** a group expense uses the category set in the group, and can't be
  changed just for you. An expense with no category counts as Other.

### Filter chips

A row of on/off chips at the top of the page: `Just mine`, then one per group. It
exists mainly for big one-off trips: a $900 share of a trip would otherwise use up
most of a $1,600 cap and set off nudges about groceries.

- **Default:** everything on.
- **Multi-select, not a dropdown,** so "everything except Big Sur" is possible.
- **Listing:** only groups with expenses in the selected month get a chip.
- **Everything on the page follows the filter:** total, progress bar, category
  limits, chart, expense lists, and nudges.
- **The cap and limits don't change.** The filter changes what's counted against
  them, not the amounts set.
- **Adding an expense is unaffected.** It always goes into Just me, and the live
  message uses the numbers currently in view.
- **Balances and groups are unaffected.** The filter only changes this page.

### Consequences

- **The mockup's privacy note must change.** "Your groups' expenses aren't counted
  here" is no longer true. It becomes something like "Your share of group expenses
  counts here, but nobody in your groups can see this page."
- **Budgets can change without you doing anything.** Someone adding or editing a
  group expense moves your numbers and can push a limit over. Nudge wording has to
  allow for that.

---

## Out of the First Version

**Recurring charges.** This removes the Recurring panel, the hatched "still to
come" bars, the Repeats option on add expense, and "of recurring still to come" in
the summary. The app has no scheduled job today. When this is picked up, the two
options are creating each charge when the page is opened (no infrastructure, but a
charge isn't recorded until the next visit) or a `pg_cron` job (exact timing, more
to run and monitor).

---

## Open Questions

1. **Should the filter be remembered?** The proposal is yes, saved to the account
   so phone and laptop match, since otherwise the trip has to be excluded on every
   visit. Not yet confirmed.
2. **Should the filter carry across months?** The proposal is yes, with a small
   "1 group hidden" label near the total, because a new expense in an excluded
   group stays uncounted until it's turned back on. Not yet confirmed.
3. **Should the limit-suggestion nudge stay?** It says things like "over two months
   out of three", which needs a few months of history. The proposal is to start
   with only the "move money" nudge.
4. **Where does this go on mobile?** The mockup's sidebar disappears on narrow
   screens and the tab bar has no obvious slot. It could be a pinned row on the
   Groups page or on Home.

---

## Existing Code to Build On

- `src/lib/spending.ts`: month helpers, category totals, and "your share" of an
  expense. It looks at one group at a time, so a view across groups is new work.
- `src/components/spending/`: month picker and charts.
- `src/queries/useAllGroupData.ts`: data across all of a user's groups.
