# Tally — Build Roadmap

## What it is
A free expense-splitting app. Groups of people log shared costs, the app tracks who paid what, and calculates the minimum transfers needed to zero everyone out. Two entry points: ongoing **Groups** for regular splits (roommates, trips), and **Split a bill** for a quick one-time receipt split that auto-creates a group behind the scenes.

---

## Tech Stack

### Frontend
| Tool | Why |
|---|---|
| **Next.js 14+ (App Router)** | File-based routing, middleware auth, API routes for Ollama proxy. Deploys natively to Vercel. |
| **Zustand** | Lightweight client state (active group, open modals) |
| **TanStack Query** | Server state — fetch, cache, optimistic updates, auto-refetch on invalidation |
| **Custom CSS tokens** | Tally design system (T object). No Tailwind needed. |

### Backend
| Tool | Why |
|---|---|
| **Supabase** | Postgres + Auth + Realtime + Storage. Free tier is generous. |
| **Row Level Security** | Enforced at DB level — users only see groups they belong to |
| **Supabase Edge Functions** | Email sending (Phase 3), any server-side logic |

### Hosting
- **Frontend**: Vercel — free tier, auto-deploys from GitHub
- **Backend**: Supabase Cloud — free up to 500MB DB, 2GB bandwidth

---

## Database Schema

```sql
profiles        -- auth.users extension. user_id nullable for guest profiles (Phase 2).
groups          -- id, name, emoji, created_by, created_at
group_members   -- group_id, user_id, joined_at
expenses        -- id, group_id, paid_by, description, amount,
                -- split_type (equal | exact | itemized),
                -- category (emoji), tax, tip,
                -- expense_date, created_at, updated_at
expense_splits  -- id, expense_id, user_id, owed_amount (final computed amount)
expense_items   -- id, expense_id, name, price (for split_type = itemized)
expense_item_assignments -- item_id, user_id (many-to-many — empty = unassigned/shared)
settlements     -- id, group_id, from_user, to_user, amount, note,
                -- settled_date (user-set), created_at (recorded), status (pending | confirmed)
notifications   -- settlement_confirm, settlement_confirmed, settlement_denied
```

Full schema with constraints lives in `CLAUDE.md`.

**Core rule**: Balances are computed at runtime from `expense_splits` and `settlements`. Never stored.

---

## MVP Definition

The minimum that makes the app genuinely useful. Two people should be able to:

1. Create accounts
2. Create a group and add each other
3. Log a shared expense (equal split)
4. See who owes what
5. Record a settlement and confirm it

That's it. Everything else is Phase 2+.

---

## Build Phases

### Phase 0 — Foundation (3–5 days)
Stand up the project before writing any features.
- [ ] Vite + React + TypeScript scaffold
- [ ] Supabase project — schema migrations + RLS policies
- [ ] Auth — email/password (Google OAuth can come later)
- [ ] GitHub → Vercel deploy pipeline
- [ ] Design tokens, fonts, and base components wired in

### Phase 1 — MVP (2–3 weeks)
Equal split only. Existing Tally users only (no guests yet).

**Groups**
- [ ] Create group (name + emoji)
- [ ] Group list with balance badges
- [ ] Group detail — member balances, simplified "who pays who", expense list
- [ ] Add members by searching existing users

**Expenses**
- [ ] Add expense — description, amount, paid by, equal split, date
- [ ] Category auto-detection from description (keyword matching, no API call)
- [ ] Expense list in group detail (newest first)

**Balances**
- [ ] `calcNetBalances` — computed from expense_splits + settlements
- [ ] `simplifyDebts` — greedy min-transfer algorithm
- [ ] Balance badges (mint = owed, coral = owes, neutral = settled)

**Settle up**
- [ ] Record a settlement (pre-fills with outstanding balance)
- [ ] Settlement confirmation — pending ⏳ → confirmed ✓ or denied
- [ ] In-app notifications for settlement confirm requests (bell icon, pinned in activity)

**Milestone**: Create a group, add a friend, split a dinner, see the balance, settle up, confirm it. The full loop works.

---

### Phase 2 — Full Features (2–3 weeks)
Everything needed for real day-to-day use.

**Splits**
- [ ] Exact split — manually set each person's amount
- [ ] Itemized split — enter line items, assign to members, tax/tip distributed proportionally
- [ ] Expense edit (with `updated_at` tracking so edits surface in activity feed)
- [ ] Expense delete (soft delete, creator only)

**"Split a bill" flow**
- [ ] FAB → mode sheet ("Add to group" or "Split a bill")
- [ ] "Split a bill" silently creates a group named "Dinner · May 21"
- [ ] Goes straight to itemized expense flow
- [ ] User can rename the auto-created group later

**Guest profiles**
- [ ] Add person by name only (no email required)
- [ ] Guest shows in group with ⏳ badge, balance tracks normally
- [ ] Organiser marks guest as paid directly (no confirmation flow for guests)
- [ ] Share invite link via any channel (iMessage, WhatsApp, etc.)
- [ ] Claim paths: auto via email match, manual link by group member, claim token URL

**Activity feed**
- [ ] Home screen — recent activity across all groups, last ~10 items
- [ ] Activity tab — full chronological feed (expenses + settlements merged, sorted by created_at)
- [ ] Two sections: confirmation requests pinned at top, everything else below
- [ ] Realtime updates via Supabase subscriptions

**Polish**
- [ ] Expense category picker (manual override of auto-detected category)
- [ ] Realtime balance updates
- [ ] Group settings — rename, add/remove members, leave group

**Milestone**: Use this for a real trip with mixed Tally/non-Tally friends and trust it completely.

---

### Phase 3 — Differentiation
Where Tally pulls ahead of free Splitwise.

- [ ] Receipt scanning — Gemini Vision API (free tier 1,500 req/day)
  - Photo → structured JSON (merchant, line items, tax, tip) in one call
  - Pre-fills the itemized expense form
- [ ] Email notifications — Resend or Brevo (free tier sufficient)
  - Settlement confirmation requests
  - Group invite emails (when email provided for guest)
  - Triggered via Supabase Edge Functions on notification insert
- [ ] Dark mode (token system already designed for it)
- [ ] PWA manifest + offline expense entry (queue + sync)
- [ ] CSV export

**Milestone**: Receipt scanner + no paywalls = clear reason to switch from Splitwise.

---

### Phase 4 — Polish
- [ ] Onboarding flow for first-time users
- [ ] Multi-currency display
- [ ] Performance audit (bundle size, LCP, JS parse time)
- [ ] Accessibility pass (keyboard nav, screen readers, colour contrast)
- [ ] Analytics — Plausible (privacy-friendly, $9/mo)

---

## Key Technical Decisions

**Balances computed at runtime, never stored.**
Load group page → fetch expenses + settlements in parallel → run `calcNetBalances` in JS → render. The calculation is O(n) and runs in microseconds for any realistic group size. Adding/editing/deleting an expense just invalidates the TanStack Query cache, which triggers a refetch and recompute automatically.

**TanStack Query is the data layer.**
Two hooks per page (`useQuery` for reads, `useMutation` for writes). Mutations use optimistic updates — the UI updates immediately, rolls back on failure. `invalidateQueries` after a mutation keeps everything in sync without manual state management.

**Activity feed is derived, not stored.**
No separate events table. The activity feed is a merged + time-sorted query over `expenses` and `settlements`. `created_at DEFAULT now()` on every table is the event log. Edited expenses surface via `updated_at`. No extra writes, nothing to get out of sync.

**Settlement confirmation is optimistic.**
A pending settlement counts toward balances immediately. The ⏳ indicator is UI only. Confirmation locks it in, denial deletes the row and reverts the balance. Guest profiles skip confirmation — organiser is the source of truth.

**Partial settlements just work.**
Settlements are not tied to specific expenses. A $10 payment against a $15 balance leaves a $5 balance. Multiple settlements stack. `calcNetBalances` sums them all.

**Everything is a group.**
There is no separate quick-split data model. "Split a bill" silently creates a group, adds an itemized expense, and invites participants. The distinction is UX only — the data model is identical.

**Guest profiles are a profile variant, not a separate system.**
`profiles.user_id` is nullable. `expense_splits`, `settlements`, and `group_members` all reference `profiles.id` and work identically for guests. Claiming = one UPDATE. Zero downstream changes.

**RLS from day one.**
```sql
CREATE POLICY "group members only" ON expenses
  USING (group_id IN (
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  ));
```
Apply same pattern to `expense_splits`, `settlements`, `expense_items`, `expense_item_assignments`.

**No email service in MVP.**
Supabase handles auth emails. Everything else is in-app only. Add Resend/Brevo in Phase 3 when real users ask for it.
