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
| **Tailwind v4 + design tokens** | Tally design system (T object + CSS variables wired into Tailwind) |

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
- [x] Notification bell polling every 30s (active tab only)

**User discovery**
- [x] QR code / add by code (`/add/:add_code`) — add a user to a group by scanning their code
- [x] Member search — three modes: @handle, add_code exact match, name fuzzy
- [x] Public share view (`/expense/:share_token`) — no auth required

**Milestone**: ✅ Full loop works end to end.

---

## Phase 2 — Full Features

Everything needed for real day-to-day use.

**Expenses**
- [ ] Exact split — manually set each person's share
- [ ] Expense edit — any member can edit, audit trail written to `expense_history`
- [ ] Expense delete — soft delete, show "(deleted)" in activity feed

**Groups**
- [ ] Group settings page — rename group, change emoji, leave group
- [ ] "Former member" display for users who left (balance history preserved)
- [ ] Fix founding member flow — `addMembersToGroup` currently inserts with `status: 'pending'` (the DB default), triggering invite notifications immediately. Members added during group creation should be inserted with `status: 'active'` so no notification fires. The pending/notification flow should only apply when adding someone to an existing group. Also fix `invited_by` — it is never set, so accept/decline notifications back to the inviter are silently dropped.

**Activity**
- [ ] Activity tab — full cross-group feed with confirmation requests pinned at top
- [ ] "(edited)" label on expenses where `updated_at != created_at`

**Notifications**
- [ ] Group invite notifications — accept/decline pending membership from Me tab
- [ ] Unread count badge on bell icon

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

- [ ] Guest profiles — add someone by name only, no account required
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
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  ));
```
Same pattern on `expense_splits`, `settlements`, `expense_items`, `expense_item_assignments`.
