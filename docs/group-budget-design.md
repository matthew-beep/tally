# Group Budget Design

**Phase 1 is built on `feature/group-budgets` and not yet merged.** Its migration,
`20261104000000_group_budgets.sql`, must be applied before the code ships. Phases 2
and 3 are still a plan. Revised 2026-11-04. This replaces the earlier plan for a
private personal budget page at `/budget`.

**Mockups** are in the
[`splitter` design artifact](https://claude.ai/artifact/KnoP5GyCsFfkRL72SEZayr):

| Page | Status |
|---|---|
| `Group Stats Tab.html` | **The reference for this plan**: desktop and phone |
| `Group Budget.html`, `Group Budget Mobile.html` | The same budget in the existing banner and sheet, not the chosen layout |
| `Just Me Budget.html`, `Just Me Budget - Stacked.html`, `Just Me Mobile.html` | The earlier personal budget. Useful only for phase 3 |

---

## The Problem

Tally tracks what people owe each other, not what they spend. A household that
wants to spend $3,000 a month, or $400 on groceries, has to work out where it
stands by hand. Someone tracking only their own money has nowhere obvious to do it,
and nobody can see what they've spent across all their groups.

---

## The Plan

| Phase | What ships | Migration |
|---|---|---|
| **1. Group budgets** | A shared budget in each group, a Stats tab, and solo groups with an invite warning | Yes |
| **2. Your spending** | A private, read-only total of your share across all groups | No |
| **3. Personal monthly cap** | Optional, only if phase 2 leaves people wanting it | Yes |

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Whose budget | The group's, visible to its active members | A household budget is meant to be shared, and this needs no private data model. |
| What it measures | The group's full expense amounts, whoever paid | Matches the existing "Whole group" view, and nobody's share has to be worked out. |
| Shape | A monthly total, category limits, or both | Some groups only care about one category. |
| Who can edit | Any active member | Matches how expenses and group names already work. |
| Past months | Each month keeps the budget it had | Changing a budget shouldn't rewrite how earlier months look. |
| Categories | The app's existing 7 (`src/lib/categories.ts`) | Group expenses already use them. An expense with no category counts as Other. |
| Layout | Expenses and Stats tabs in each group | Gives the budget and breakdown a home without crowding the feed. |
| App navigation | Keep Home, Groups, Activity, Me | A group budget belongs in the group. |
| Personal tracking | A solo group is a normal group | One budget system, and no special cases. |
| Recurring charges | Not included | Expenses are added by hand, and the app has no scheduled job. |

### Alternatives Rejected

- **A hidden personal group.** It would reuse expense code, but it needs filters
  across group screens and database triggers to keep other people out. A visible
  solo group needs neither.
- **Personal expenses in separate tables.** Keeps them isolated, but duplicates
  saving, editing, history, and share calculations.
- **Personal expenses in `expenses` with no group.** `group_id`, `paid_by`, and
  `expense_splits.group_member_id` are all required today, so this weakens the
  constraints on the core money tables.

---

## Phase 1: Group Budgets

### Stats Tab

Each group page gets two tabs:

- **Expenses:** the default, with the existing feed. `SpendingBanner` goes away.
- **Stats:** the contents of `SpendingSheet` move onto the page, with the budget
  added. Phone is one column with the tabs staying in view. Desktop has the month
  controls and budget on the left, and the chart and categories on the right.

Category detail opens inside the tab, with a way back to all categories. Only
editing a budget opens a sheet.

### Budget Card

Sits under the month's total, for the selected month:

- **Current month:** percentage used, amount left, and "about $38 a day for the next
  27 days". Past the total, the wording stays gentle: "Nothing breaks, and December
  starts fresh."
- **Past month:** "Finished $46 under budget" or "Finished $612 over budget". It's
  measured against that month's budget and can't be edited.
- **Over a category limit:** the card names the category.
- **Month with no budget:** a short note. On the current month, a prompt to set one.
- **All time:** no card, because there's no single budget to compare against.
- **Your share view:** the card is hidden with a short note, since comparing your
  share against a whole-group budget would mislead.

There's deliberately no "Today" marker or "ahead of pace" message. A household's
rent lands on the 1st, so any pace judgment would say it's behind for most of the
month.

### Categories and Charts

- Categories with a limit come first, sorted by how much of the limit is used. Their
  bars fill toward the limit and turn coral when over.
- Categories with no limit show "no limit" and still count toward the total.
- "Over time" draws each month's total as a dashed line across its bar, and category
  detail does the same with that category's limit.

### Editing

- A sheet with a monthly total and a limit per category, each with its own toggle.
- It shows how much of the total the limits use. Limits may add up to more than the
  total, with a note saying so.
- Changes apply from the current month. "Remove budget" also applies from the current
  month, so past months keep theirs.
- First-time setup fills in the total from the group's monthly average so far.
- Saving needs at least a total or one limit.

### Solo Groups

A solo group is a normal group with one member. `POST /api/groups/create` already
allows this. The share controls and "How it splits" are hidden when there's only one
member.

The first invite to a one-person group that has expenses shows a warning: "They'll
see all 18 past expenses and the budget, and they'll be able to change them. To keep
this private, start a new group with them instead." It has to cover **every way in**:
adding a member, adding a guest, and sharing the invite link.

### Schema

The migration adds two tables and changes no existing data. A group with no rows has
no budget.

```sql
group_budgets (
  group_id     uuid → groups ON DELETE CASCADE,
  starts_month date NOT NULL,        -- first day of the month
  monthly_cap  numeric(10,2) CHECK (monthly_cap > 0),  -- NULL = no monthly total
  created_by   uuid → profiles,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, starts_month),
  CHECK (EXTRACT(DAY FROM starts_month) = 1)
)

group_budget_limits (
  group_id     uuid,
  starts_month date,
  category     text NOT NULL,        -- emoji, same as expenses.category
  amount       numeric(10,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (group_id, starts_month, category),
  FOREIGN KEY (group_id, starts_month)
    REFERENCES group_budgets ON DELETE CASCADE
)
```

- **Finding a month's budget:** the latest row with `starts_month` on or before that
  month. No total and no limits means no budget from then on, which is how removal
  works.
- **Saving:** a `save_group_budget` function writes the total and replaces the limits
  in one transaction, so a failed save can't leave half a budget. It updates the
  current month's row if there is one, and otherwise adds one. `SECURITY INVOKER`, as
  with `update_expense_with_splits`.
- **Past months:** `save_group_budget` rejects a month before the current one, with a
  day of grace for a browser behind in its timezone. A member writing to the tables
  directly isn't stopped, since RLS only checks membership.
- **RLS:** active members can read and write through `get_my_group_ids()`, which
  excludes pending and left seats.

### Calculations

A new pure module, `src/lib/budget.ts`, takes the group's expenses and budget rows and
returns each month's budget, spent, and left, plus each limit's state. It builds on
`calcSpending` in `src/lib/spending.ts`, which already leaves out deleted expenses and
never reads settlements. Nothing here feeds a balance.

Reads use a TanStack query keyed `['budget', groupId]`, invalidated on save, with no
`refetchInterval`. Someone else's edit shows up on the next refetch, like other group
data.

### What Got Built

- `src/lib/budget.ts`, `src/queries/useGroupBudget.ts`
- `src/components/spending/GroupStats.tsx`, which replaces `SpendingSheet` and
  `SpendingBanner`, plus `BudgetCard.tsx` and `BudgetEditSheet.tsx`
- `src/components/SoloInviteWarning.tsx`, used by group settings (member, guest, and
  invite link) and the QR add page

Two details differ from the mockups: `Segmented` uses its neutral tone, since Stats now
sits on a page with a primary action, and removing a budget takes a second tap.

---

## Phase 2: Your Spending

A private, read-only view of what you've spent across all your groups, including a
solo group.

- **Shows:** your share for the month, broken down by category and by group, with a
  month picker.
- **Counts your share only:** a $200 dinner where your share is $50 counts as $50.
  Deleted expenses and settlements are left out.
- **Where:** the Me tab, plus a desktop sidebar link in `PRIMARY_NAV`.
- **Private:** it's calculated in your browser from data you can already see. Other
  members never see your total.
- **No migration:** `useAllGroupData` already loads expenses and members for every
  group. The new work is a function that finds your seat in each group and combines
  each group's `calcSpending(expenses, month, 'mine', seatId)` result. Seats are per
  group, so one ID can't be used across all of them.

---

## Phase 3: Personal Monthly Cap

Only if people want a limit on the phase 2 total. It would need a small table keyed by
user, with the same "each month keeps its budget" rule, and an edit screen. Decide
after phase 2 is in use.

---

## Open Questions

1. **Should Expenses show a small budget line?** With the banner gone, the budget is
   out of sight until you open Stats. The proposal is a line such as "$1,025 left"
   above the feed, shown only when the group has a budget, opening Stats when tapped.
2. **Should a budget change be announced?** Any member can change a shared budget, and
   nothing currently tells the others. Options are an Activity entry, a notification,
   or nothing for the first version.
3. **Should there be nudges?** The earlier design offered to move money between
   categories. That changes a shared budget for everyone, so it's left out for now.

---

## Existing Code for Later Phases

- `src/queries/useAllGroupData.ts`: data across all groups, for phase 2.
- `src/lib/spending.ts`: `calcSpending(expenses, month, 'mine', seatId)` gives your share
  in one group, for phase 2 to combine across groups.
