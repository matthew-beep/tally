# Tally — Build Roadmap

## What it is
A free expense-splitting app. Groups of people log shared costs, the app tracks who paid what, and calculates the minimum transfers needed to zero everyone out. Like Splitwise, but free with no paywalled features.

---

## Tech Stack

### Frontend
| Tool | Why |
|---|---|
| **Next.js 16+ (App Router)** | File-based routing, proxy auth, API routes. Deploys natively to Vercel. |
| **Zustand** | Lightweight client state (active group, open modals) |
| **TanStack Query** | Server state — fetch, cache, optimistic updates, auto-refetch on invalidation |
| **Design tokens (CSS variables + inline styles)** | `T` object in `src/design/tokens.ts` reads CSS vars from `globals.css` (light + dark). No CSS framework. |

### Backend
| Tool | Why |
|---|---|
| **Supabase** | Postgres + Auth. Free tier is generous. |
| **Row Level Security** | Enforced at DB level — users only see groups they belong to |

### Hosting
- **Frontend**: Vercel — auto-deploys from GitHub
- **Backend**: Supabase Cloud

---

## Phase 1 — MVP ✅ Complete

The minimum loop: create a group, add a friend, split an expense, see who owes what, settle up, confirm it.

**Auth & onboarding**
- [x] Google OAuth sign-in
- [x] Dev email/password login (local only)
- [x] Auth proxy — protects all routes, session refresh on every request
- [x] Onboarding — pick @handle after first sign-in, real-time availability check

**Groups**
- [x] Create group — name, emoji picker, add members inline, live preview panel
- [x] Group list with balance badges
- [x] Group detail — balance hero, "who pays who", activity feed
- [x] Add members to existing group (search by handle/name/add_code)
- [x] Invite link (`/invite/:token`) — auto-joins group after sign-in

**Expenses**
- [x] Add expense — description, amount, paid by, equal split, date
- [x] Category auto-detection from description (keyword matching, no API call)
- [x] Activity feed in group detail (expenses + settlements merged, date-grouped)

**Balances**
- [x] `calcNetBalances` — computed from expense_splits + settlements, never stored
- [x] `simplifyDebts` — greedy min-transfer algorithm
- [x] Balance badges (mint = owed, coral = owes, neutral = settled)
- [x] Home screen net balance hero (aggregated across all groups)

**Settle up**
- [x] Record a settlement (pre-fills with outstanding balance)
- [x] Settlement confirmation — pending ⏳ → confirmed ✓ or denied ✗
- [x] In-app notifications (Me tab) with confirm/deny actions

**User discovery**
- [x] QR code / add by code (`/add/:add_code`) — add a user to a group by scanning their code
- [x] Member search — three modes: @handle, add_code exact match, name fuzzy

**Milestone**: ✅ Full loop works end to end.

---

## Phase 2 — Full Features

Everything needed for real day-to-day use.

**Expenses**
- [x] Exact split — manually set each person's share (percentage split also shipped)
- [x] Expense edit — any member can edit amount/description/payer via bottom-sheet drawer; audit trail written to `expense_history` by trigger
- [x] Expense delete — soft delete with confirmation sheet (deleted expenses drop out of feed and balances)
- [ ] Edit history viewer — surface `expense_history` snapshots from the expense sheet

**Groups**
- [ ] Group settings page — rename group, change emoji, leave group
- [ ] "Former member" display for users who left (balance history preserved)
- [x] Guest members — add by name only (`group_members` row with `user_id NULL`), during creation or later (claim flow still Phase 4)

**Activity**
- [x] Activity tab — full cross-group feed (confirmation requests live on the Me tab)
- [ ] "(edited)" label on expenses where `updated_at != created_at`

**Notifications**
- [x] Group invite notifications — accept/decline pending membership from Me tab
- [ ] Unread count badge + 30s poll on nav bell
- [ ] Public share view (`/expense/:share_token`) — skeleton exists, needs service-role fetch

**Milestone**: Use this for a real trip and trust it completely.

---

## Phase 3 — Differentiation

Where Tally pulls ahead of free Splitwise.

- [ ] Receipt scanning — homelab Ollama OCR proxy (`/api/ocr`)
  - Photo → structured JSON (merchant, line items, tax, tip)
  - Pre-fills the itemized expense form, inside add expense (not a separate flow)
- [ ] Itemized split — line items, assign to members, tax/tip distributed proportionally
- [ ] "Split a bill" quick flow — FAB → silently creates a group, goes straight to itemized expense
- [ ] Email notifications — settlement confirm requests, group invites (Resend or Brevo)
- [ ] Dark mode (token system already supports it)
- [ ] PWA manifest + offline expense entry (queue + sync)

**Milestone**: Receipt scanner + no paywalls = clear reason to switch from Splitwise.

---

## Phase 4 — Polish

- [ ] Guest claim flow — guests already exist (name-only member rows); claiming links a real account to the seat
  - Organiser marks guest as paid directly (no confirmation flow)
  - Claim paths: auto via email match, manual link, claim token URL
- [ ] Multi-currency display
- [ ] CSV export
- [ ] Performance audit (bundle size, LCP, JS parse time)
- [ ] Accessibility pass (keyboard nav, screen readers, colour contrast)
- [ ] Analytics — Plausible

---

## Key Technical Decisions

**Balances computed at runtime, never stored.**
Load group page → fetch expenses + settlements in parallel → run `calcNetBalances` in JS → render. The calculation is O(n) and runs in microseconds for any realistic group size.

**No Realtime until Phase 3.**
TanStack Query's `refetchOnWindowFocus` + `refetchOnMount` cover the async use case (people log expenses and check later). Realtime belongs in itemized receipt splitting where multiple people are on the same screen simultaneously.

**Activity feed is derived, not stored.**
No separate events table. Merged + sorted query over `expenses` and `settlements`. `created_at` on every table is the event log.

**Settlement confirmation is optimistic.**
A pending settlement counts toward balances immediately. Confirmation locks it in, denial deletes the row and reverts the balance.

**Everything is a group.**
No separate quick-split data model. "Split a bill" silently creates a group and adds an itemized expense. The distinction is UX only.

**RLS from day one.**
```sql
CREATE POLICY "group members only" ON expenses
  USING (group_id IN (
    SELECT group_id FROM group_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));
```
Same pattern on `expense_splits` and `settlements` (see `docs/schema.md` for the deployed policies and two RLS fixes).
