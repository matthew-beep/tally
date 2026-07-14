# Tally — Documentation

As-built documentation for the Tally codebase. These docs describe what is
**actually implemented** — where they disagree with `CLAUDE.md` (the original
design spec), the code and these docs win. Notable drift is called out inline.

| Doc | Contents |
|---|---|
| [schema.md](./schema.md) | Database schema as deployed, identity model, triggers, RLS |
| [flows.md](./flows.md) | End-to-end user flows with the code that implements each step |
| [features.md](./features.md) | Feature → code map: routes, query hooks, components, libs |
| [feature-status.md](./feature-status.md) | Point-in-time review: what's done vs. missing, mobile + desktop |
| [review-checklist.md](./review-checklist.md) | File-by-file reading order for a full manual code review |

## What Tally is

A free expense-splitting app (Splitwise without the paywall). Groups of people
log shared costs; the app tracks who paid what and computes the minimum set of
transfers to zero everyone out.

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
