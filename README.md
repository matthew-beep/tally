# Tally

A free expense-splitting app. Groups of people log shared costs, Tally tracks
who paid what and calculates the minimum transfers to zero everyone out —
like Splitwise, but free with no paywalled features.

**Stack**: Next.js (App Router) · Supabase (Postgres + Google OAuth) ·
TanStack Query · Zustand · Vercel.

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/`](./docs/README.md) | **As-built docs** — schema, user flows, feature → code map |
| [`CLAUDE.md`](./CLAUDE.md) | Original design spec + AI session context (has drifted; `docs/` wins) |
| [`TODO.md`](./TODO.md) | Active task list |
| [`tally-roadmap.md`](./tally-roadmap.md) | Phase roadmap |
| [`tally-style-guide.md`](./tally-style-guide.md) | Design system — tokens, type, color |
| [`UX-SPEC.md`](./UX-SPEC.md) | Product/UX spec — principles, flows, screens |

## Development

```bash
npm install
npm run dev          # localhost:3000
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

Copy `.env.local.example` → `.env.local` and fill in the Supabase keys.
Database migrations live in `supabase/migrations/`.
