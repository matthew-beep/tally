# Expense social + group leaderboard — design

**Status:** design agreed 2026-08-08. Phases A–C and D1 shipped (leaderboard,
detail drawer, reactions, comment thread + composer). **D2 (comment
discoverability chip) is decided and next priority** — see Phasing. Phase E
(comment notifications) is still planned, not built. This is a *design* doc,
not as-built — where it describes components that don't exist yet, they don't
exist yet.

Source: the `Group Page Social.html` artboard in the Claude Design project
(`36d6382c-156c-422e-afd2-063025ff0a0f`), which consolidates the earlier 3×3
exploration in `expense-social.jsx` — three expense-detail layouts × three
leaderboard treatments × three reaction patterns. Social picks one of each:
reaction **pills**, leaderboard **bars**, detail **social**.

---

## The three surfaces

### 1. Feed rows carry reaction pills

Each expense row grows a pill strip underneath: `😍 2` `💸 1`, plus a dashed
`😊` button opening a six-emoji popover picker. With no reactions the strip
collapses to a single dashed `😊 React` ghost button.

The artboard also restyles the feed itself — per-expense cards, 16px radius,
10px gaps — where the group page today renders month-bucketed rows inside one
grouped surface card. **This is a decision, not a given** (see Open questions).

### 2. Collapsible leaderboard card

🏆 **Leaderboard** / "Who fronted the most". Collapsed by default. Expands to
ranked horizontal bars scaled to the top spender: rank number, avatar, name,
amount, bar. #1 gets `sun`, you get `mint`, everyone else `lineStrong`. Footer
line: total spent across the group.

### 3. Expense detail drawer

A 90%-height bottom sheet replacing the row tap. Header (emoji tile,
description, "Jordan paid · date", amount), optional note, split rows showing
**net** per person (payer `+$126`, others `−$42`), a facepile Reactions section
(emoji + avatar stack + names) with a six-tile quick-react grid, a Comments
list, and a sticky Edit / Delete footer.

This replaces `ExpenseActionSheet`'s current *actions menu* framing (a list of
Edit / Delete buttons) with a content-first detail view where edit and delete
are demoted to a footer.

---

## Data model

Both new tables key by **`group_members.id`** — the seat, not the profile.

Reactions and comments are in-group social. Seat keying means they render
through the exact path the feed already uses (`memberById[id]`,
`slotFor(members, id)`, `avatarProfile`), group scoping comes free via the
expense, and a member who leaves keeps their history attributed. This is the
same reasoning that put the money tables on seats — see
[schema.md](./schema.md#identity-model--the-one-thing-to-internalize).

```sql
expense_reactions (
  id               uuid PK,
  expense_id       uuid → expenses ON DELETE CASCADE NOT NULL,
  group_member_id  uuid → group_members ON DELETE CASCADE NOT NULL,
  emoji            text NOT NULL CHECK (char_length(emoji) <= 8),
  created_at       timestamptz DEFAULT now(),
  UNIQUE (expense_id, group_member_id, emoji)   -- toggle = INSERT / DELETE
)

expense_comments (
  id               uuid PK,
  expense_id       uuid → expenses ON DELETE CASCADE NOT NULL,
  group_member_id  uuid → group_members ON DELETE CASCADE NOT NULL,
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
)
```

The six-emoji set (`😍 😂 💸 🙏 🔥 👀`) stays an app-layer whitelist. A SQL
CHECK would bake it in, and that set will change.

### RLS needs two conditions, not one

Every existing table gates on group membership alone. These need that **plus**
an author check on INSERT, or any member can post as another seat:

```sql
-- read: standard membership gate
group_member_id IN (SELECT id FROM group_members
                    WHERE group_id IN (SELECT get_my_group_ids()))

-- insert: the seat you write must be yours
EXISTS (SELECT 1 FROM group_members gm
        WHERE gm.id = group_member_id AND gm.user_id = auth.uid())
```

This is a new policy shape for the codebase. `schema.md` records two silent
critical RLS bugs that survived testing because local dev didn't match prod
policies — worth writing these carefully and verifying against the live DB.

### New invariant

> **Reactions and comments never touch balances.** They are the first
> non-financial rows in a group. They must never enter `calcNetBalances`,
> `calcPairwiseNets`, or `mergeFeed`.

Reactions on a soft-deleted expense simply stop being fetched — no cleanup
needed. The `ON DELETE CASCADE` only fires on a hard delete, which expenses
never get.

---

## Fetching

**Do not join comments into `expensesQueryOptions`.** That cache is fanned out
by `useAllGroupData` across every group for the dashboard — comment bodies
would bloat the global balance fetch on every dashboard load.

| Key | Contents | Consumer |
|---|---|---|
| `['expense-social', groupId]` | all reactions for the group + comment **counts** per expense | feed pill strips, row comment chips |
| `['expense-comments', expenseId]` | comment bodies | detail drawer, fetched lazily on open |

Reactions are the textbook optimistic mutation — toggle the cache instantly,
invalidate on success, roll back on error. No Realtime; this stays inside the
existing refetch-on-focus/mount model (`CLAUDE.md` → Sync strategy).

---

## Leaderboard

Zero schema. Pure derivation from caches already held by the group page:

```
paid[m]  = Σ expenses.amount     where paid_by = m         (live expenses only)
txns[m]  = count of those expenses
```

Lives in `src/lib/leaderboard.ts`, tested in `leaderboard.test.ts`.

**`paid` is gross fronted, unaffected by settlements — it is not a balance.**
That distinction is the whole reason the card is safe to show: "Who fronted the
most" is a fact about generosity, not a claim about debt. Any copy that reads
like "who owes" is wrong. The members ledger in the desktop left rail already
covers net standing; this is deliberately a different number.

Behaviour:

- Pending, left, and guest seats are **included** — they fronted real money.
- Zero-spend group → the card hides entirely.
- Sort is `paid` descending, stable, so ties keep group member order.
- Σ `paid` across entries equals the group's total spent, which is what the
  footer line shows.

---

## Open questions

1. **Feed layout.** Adopting per-expense cards is a visual change to the whole
   group feed, not an addition. Alternative: keep the grouped month card and
   render pills as a compact inline suffix on the caption line. The artboard
   assumes cards.
2. **Desktop.** The artboard is 390-wide only. The leaderboard's natural home
   is the left rail under the members ledger, but that rail already sorts by
   net standing, and two adjacent rankings of the same people measuring
   different things needs its own artboard. Phase A ships it in the shared
   right column for both breakpoints as an interim.
3. **Settlement rows** — reactable? Proposed: no.
4. **`/expense/[share_token]`** — the public page must exclude reactions and
   comments, or it leaks member names to unauthenticated viewers.
5. **Comment notifications** — a new `notifications` type plus trigger, which
   collides with the in-flight `batch_id` work. Deferred. Reactions should
   never notify.

---

## Phasing

Each phase ships independently.

| Phase | Scope | Schema |
|---|---|---|
| **A** | Leaderboard card | none |
| **B** | Detail drawer — refactor `ExpenseActionSheet`'s `Screen` from `'actions' \| 'edit' \| 'delete-confirm'` to `'detail' \| …`, replace the menu body with detail content, move Edit/Delete into `ModalFooter` | none |
| **C** | Reactions — table, RLS, optimistic toggle, pills in feed, facepile in drawer | `expense_reactions` |
| **D1** | Comments — table, RLS, composer, thread in drawer | `expense_comments` |
| **D2** | Comment discoverability — feed rows show reaction pills but no comment indicator today, so a thread is invisible until you open the drawer. **Decided 2026-08-16: priority, build next.** Needs a `💬 N` chip on the feed row, which means folding comment counts into the `['expense-social', groupId]` query (see Fetching) rather than the current comments-only-fetched-on-open model | none — reuses `expense_comments` |
| **E** | Comment notifications, if wanted at all | enum + trigger |

B before C/D deliberately: the drawer is the container the social content drops
into, and it carries no migration risk.
