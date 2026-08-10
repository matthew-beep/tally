# Domain docs

One doc per domain, each answering everything about that domain: schema meaning,
read path, write paths, invariants, decisions, gaps. Vertical slices — the rest
of `docs/` slices horizontally (one doc per concern, all domains inside).

Use these when you're **working on a domain**. Use [schema.md](../schema.md),
[flows.md](../flows.md) and [data-loading-architecture.md](../data-loading-architecture.md)
when you're working on a *concern* across domains.

## The docs

| Doc | Owns | Status |
|---|---|---|
| [settlements.md](./settlements.md) | `settlements` | ✅ |
| [balances.md](./balances.md) | *derivation* — `lib/balance.ts`, `useGlobalBalances` | ✅ |
| expenses.md | `expenses`, `expense_splits`, `expense_history` | ☐ wave 2 |
| membership.md | `groups`, `group_members` | ☐ wave 2 |
| notifications.md | `notifications` | ☐ wave 2 |
| identity.md | `profiles` | ☐ wave 3 |
| activity.md | *derivation* — `lib/feed.ts`, `useAllActivity` | ☐ wave 3 |
| social.md | `expense_reactions`, `lib/leaderboard.ts` | ☐ wave 3 |

## Ownership rules

These are what stop nine docs from becoming nine copies of the same drift.

- **`schema.md` owns DDL.** Every column, every constraint, complete. Domain docs
  carry only the columns that *mean* something, with the reasoning. Don't restate
  `created_at`.
- **Domain docs own decisions.** Why the shape is the shape, including rejected
  alternatives. This is the material that otherwise lives only in TODO.md and
  disappears when the item ships.
- **`flows.md` owns cross-domain journeys** (onboarding, invite → join, first
  expense). A journey that spans four domains belongs to none of them. Per-domain
  mechanics belong in the domain doc.
- **`features.md` owns the index** — route/hook/component → file. No reasoning.
- **`data-loading-architecture.md` owns the cache model** as one system. Domain
  docs name their own keys and invalidation, and link here for the model.
- **Review artifacts stay put** — `feature-status.md`, `review-todo.md`,
  `responsive-qa.md`, `review-checklist.md`, `publish-roadmap.md` are
  point-in-time and are not domain docs.

## The two templates

Domains that own tables and domains that own math need different sections. Pick
by whether the domain has a table.

### Table-owning (see `settlements.md`)

1. **What it is / what it isn't** — the boundary, stated as negatives. Half the
   design usually follows from one of them.
2. **Tables owned** — meaningful columns + why. Link `schema.md` for full DDL.
3. **Invariants** — the rules every query and mutation must respect.
4. **Read path** — query options, cache keys, embeds, consumers.
5. **Write paths** — one subsection per mutation, each tracing hook → SQL →
   triggers → invalidation.
6. **Triggers & RLS** — policy names and what they actually enforce.
7. **Decisions** — including rejected alternatives and *why* they were rejected.
8. **Known gaps** — table of gap → state, distinguishing "not built" from
   "decided against".

### Derivation (see `balances.md`)

1. **What it is / what it isn't** — plus which question each function answers.
2. **Inputs** — the caches it folds, and the properties of those inputs the math
   depends on.
3. **Invariants**.
4. **The functions** — signature, contract, and the subtleties that look like
   details and aren't.
5. **Composition** — where each runs, and any identity translation.
6. **How it's guarded** — the test file is the safety net, so name what it
   covers.
7. **Decisions**.
8. **Known gaps**.

## When a domain doc absorbs an older doc

Several existing docs are pre-build design discussions that a domain doc
supersedes. When absorbing one, delete it in the same commit and add a line to
its replacement's decisions section — don't leave two versions:

| Absorbed into | From |
|---|---|
| expenses.md | — |
| membership.md | `group-member-model.md`, membership half of `notifications-and-membership-design.md` |
| notifications.md | notification half of `notifications-and-membership-design.md` |
| identity.md | `identity-and-search-spec.md`, `guest-identity-design.md` |
| social.md | `social-and-leaderboard-design.md` |
