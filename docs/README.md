# Tally — Documentation

As-built documentation for the Tally codebase. These docs describe what is
**actually implemented** — where they disagree with `CLAUDE.md` (the original
design spec), the code and these docs win. Notable drift is called out inline.

Two ways in. **[domains/](./domains/)** slices vertically — one doc per domain,
everything about it in one place; start there when you're working on a feature.
The docs below slice horizontally — one doc per concern, all domains inside;
start there when you're working on a concern across domains.

| Doc | Contents |
|---|---|
| [domains/](./domains/README.md) | **Per-domain reference** — schema meaning, read/write paths, invariants, decisions, gaps. Index lists what's written and what's pending |
| [schema.md](./schema.md) | Database schema as deployed, identity model, triggers, RLS |
| [flows.md](./flows.md) | End-to-end user flows with the code that implements each step |
| [features.md](./features.md) | Feature → code map: routes, query hooks, components, libs |
| [feature-status.md](./feature-status.md) | Point-in-time review: what's done vs. missing, mobile + desktop |
| [publish-roadmap.md](./publish-roadmap.md) | Critical path and sizing to a public launch — what blocks, what is cut |
| [react-native-port.md](./react-native-port.md) | **Plan, not as-built** — shared core vs native rewrite, Expo Router map, adapters. No packages or Expo app yet |
| [audit-fix-plan.md](./audit-fix-plan.md) | **Plan, not as-built** — 2026-08-15 audit: remaining RLS holes, invite/settle/expense write bugs, UI loading and quality nits |
| [responsive-qa.md](./responsive-qa.md) | Breakpoint contract and the per-feature mobile/tablet/desktop test sweep |
| [review-checklist.md](./review-checklist.md) | File-by-file reading order for a full manual code review |
| [notifications-and-membership-design.md](./notifications-and-membership-design.md) | Paused design discussion: invite accept/decline notifications, activity-vs-notification framework, `group_members.status` semantics |
| [social-and-leaderboard-design.md](./social-and-leaderboard-design.md) | Planned: expense reactions/comments, the expense detail drawer, and the group leaderboard — data model, RLS shape, phasing |

## What Tally is

A free expense-splitting app (Splitwise without the paywall). Groups of people
log shared costs; the app tracks who paid what and shows each person their
pairwise net with everyone they've actually split with. (Debt simplification
was built, never shipped, and removed 2026-08-02 — see `CLAUDE.md`.)

## Stack

- **Next.js 15+ (App Router)** — `src/app`, request-level auth guard in `src/proxy.ts`
- **Supabase** — Postgres + Auth (Google OAuth). No Realtime; sync via TanStack Query refetch
- **TanStack Query** — all server state (`src/queries/`)
- **Zustand** — UI-only state (`src/store/`)
- **Inline-styled React** — design tokens in `src/design/tokens.ts`, no CSS framework

## Dev commands

```bash
npm run dev          # localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
```

Env (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Optional dev login: `NEXT_PUBLIC_DEV_EMAIL`,
`NEXT_PUBLIC_DEV_PASSWORD` (surfaces a one-tap login on `/login` in dev builds).

Schema changes live in `supabase/migrations/` and are applied via the Supabase
SQL editor or `npx supabase db push`.
