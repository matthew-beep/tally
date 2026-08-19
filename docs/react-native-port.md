# React Native port — plan

_Written 2026-08-15 from a pass over `src/`. This is a **plan**, not as-built.
Nothing described here has been extracted or scaffolded. Where this disagrees
with the live Next app, the app wins until the work lands._

**Goal:** a native iOS/Android app that matches today's **mobile web** product
— four tabs, add expense, settle, invites — sharing domain logic with the
existing Next app. Desktop UI stays web-only. No JSX is shared.

**Not in this pass:** packages, an Expo app, or any code moves. Implementation
sequence is at the bottom; start there when the extract begins.

---

## Verdict

The domain layer is already React Native-ready. Screens are Next + DOM + CSS
and should be rewritten, not wrapped.

| Layer | Share? | Notes |
|---|---|---|
| `src/types`, pure `src/lib/*` | Yes, almost as-is | Tests travel with the functions |
| `src/queries/*`, Zustand | Yes, with adapters | Only `useAuth` imports `next/navigation` |
| Next API routes | Keep as the BFF | Service-role stays on Vercel |
| Tokens / theme | Share hex values, not CSS vars | RN cannot resolve `var(--tally-bg)` |
| Components / pages / CSS | Rewrite | Follow the mobile branch, not desktop |

Do **not** run this Next app through Expo, Solito, or `react-native-web`
wrappers around existing components. The desktop shell (sidebar, popovers,
two-column add-expense) is a real product; native should follow
`DockedTabBar` / sheets / `MobilePanel`.

---

## Architecture

```
packages/core          types, pure lib, query hooks, hex token objects
apps/web               this Next.js app (desktop + mobile web + API routes)
apps/native            Expo (iOS / Android)
```

Until a monorepo exists, the same split can live as `src/core/` inside this
repo. The boundary matters more than the folder name.

```
                  ┌─────────────────────────┐
                  │     packages/core       │
                  │  types · lib · queries  │
                  │  hex light/dark tokens  │
                  └───────────┬─────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     web adapters                      native adapters
     (cookies, relative                (AsyncStorage, JWT,
      /api, CSS vars)                   absolute API URL)
              │                               │
              ▼                               ▼
     apps/web  Next                    apps/native  Expo
     pages + desktop UI                screens + sheets
              │                               │
              └───────────┬───────────────────┘
                          ▼
                 POST /api/* on Vercel
                 (service-role, rate limits)
```

**Keep Next as web + BFF.** Privileged routes in `src/app/api/` use the
service-role client (`src/lib/supabase-server.ts`, `server-only`). The native
app never ships `SUPABASE_SERVICE_ROLE_KEY`. It calls those routes over HTTPS
with the user's JWT.

**Do not share JSX.** Share types, pure functions, query keys/fetchers, and
hex token objects. Native rewrites every screen.

---

## 1. Shared core — copy as-is

These files have no `document`, `window`, Next, or CSS. They are the product.

### Types

| File | Role |
|---|---|
| `src/types/index.ts` | Profile, Group, GroupMember, Expense, Settlement, Notification, … |

### Pure lib (tests travel with the functions)

| File | Role |
|---|---|
| `src/lib/balance.ts` + `.test.ts` | `calcNetBalances`, `calcPairwiseNets`, `summarizeBalances`, `calcExpenseNets` |
| `src/lib/splits.ts` + `.test.ts` | Equal / percent / exact / rescale; remainder to first row |
| `src/lib/settlements.ts` + `.test.ts` | `batchNet`, `batchStatus`, `buildSettlementBatch` |
| `src/lib/feed.ts` + `.test.ts` | `mergeFeed` |
| `src/lib/feedCards.ts` + `.test.ts` | Activity / group-feed card models |
| `src/lib/reactions.ts` + `.test.ts` | Group and toggle reaction rows |
| `src/lib/leaderboard.ts` + `.test.ts` | Gross-fronted ranking (not a balance) |
| `src/lib/notifications.ts` + `.test.ts` | Collapse rows into `NotificationBatch` |
| `src/lib/money.ts` | `round2`, `parseNum`, `formatAmount`, `splitAmount` |
| `src/lib/categories.ts` | 7 emoji categories + keyword detect |
| `src/lib/memberDisplay.ts` | `displayName`, `avatarProfile`, `slotFor` |
| `src/lib/emoji.ts` | Group + reaction emoji sets |
| `src/lib/time.ts` | `timeAgo` |

`src/lib/rateLimit.ts` is also pure, but it is **server-only** — it counts
rows with the service-role client. It stays next to the API routes, not in
the app bundle.

### Store and hooks

| File | Role |
|---|---|
| `src/store/ui.ts` | Zustand: `activeGroupId`, `fabOpen`, toasts. No persist, no DOM |
| `src/hooks/useDebouncedValue.ts` | Search debounce |
| `src/hooks/useNotificationReviewSheet.ts` | Open/close + list-vs-review for the notifications sheet |

`src/hooks/useMediaQuery.ts` is web-only (`window.matchMedia`). Native does
not need a sheet-vs-modal breakpoint — everything is a sheet.

### Add-expense state machine

`src/components/add-expense/useAddExpenseForm.ts` + `types.ts` is already a
presentation-free state machine. Native reuses the hook and writes a new
panel. Do not port `DesktopPanel.tsx`; `MobilePanel.tsx` is the visual
reference, not shareable JSX.

### Query hooks

All of `src/queries/` except navigation inside `useAuth.ts`:

| File | Hooks |
|---|---|
| `useProfile.ts` | `useCurrentProfile`, `useUpdateProfile`, `useSearchProfiles`, `useProfileByAddCode`, `useNotifications`, `useMarkNotificationsRead` |
| `useGroups.ts` | `useGroups`, `useGroup`, `useGroupMembers`, `useCreateGroup`, `useDeleteGroup`, `useUpdateGroup`, `useLeaveGroup`, `useRemoveMember`, `useInviteGuestToSeat`, `useProfileGroups` |
| `useMembers.ts` | `useAcceptGroupInvite`, `useDeclineGroupInvite`, `useRecentCollaborators` |
| `useExpenses.ts` | `useExpenses`, `useAddExpense`, `useUpdateExpense`, `useDeleteExpense` |
| `useSettlements.ts` | `useSettlements`, `useCreateSettlements`, `useConfirmSettlement`, `useDenySettlement` |
| `useExpenseSocial.ts` | `useExpenseSocial`, `useToggleReaction` |
| `useGroupDetail.ts` | Composite over the per-resource hooks |
| `useAllGroupData.ts` | `useQueries` fan-out |
| `useMyGroupIds.ts` | Ids view over `['groups']` |
| `useGlobalBalances.ts` | Derivation — no query of its own |
| `useActivity.ts` | Derivation — `mergeFeed` per group |

Query architecture does not change for native. Per-group caches stay
canonical; cross-group numbers stay client-side folds. See
[data-loading-architecture.md](./data-loading-architecture.md).

`useAuth.ts` is the only query file that imports `next/navigation`. Strip
that before sharing: pass `onSignedIn(redirect)` / `onSignedOut()` from the
UI instead of calling `router.push`. Two call sites, not one —
`useSignInWithPassword` and `useSignOut` both call `router.push` directly.
`useSignInWithGoogle` doesn't touch the router, but its browser-redirect
flow (`supabase.auth.signInWithOAuth` → `location.origin`) is web-only
regardless; native replaces it with `expo-auth-session`, it doesn't adapt it.

---

## 2. Adapters — the only platform split

Inject these so web keeps cookies and relative URLs, and native uses
AsyncStorage, absolute URLs, and a JWT.

| Concern | Web today | Native |
|---|---|---|
| Supabase | `src/lib/supabase.ts` — `@supabase/ssr` `createBrowserClient` + cookies + `processLock` | `@supabase/supabase-js` + AsyncStorage. No `navigator.locks` |
| `postJson` | `src/lib/api.ts` — relative `/api/...`, cookie session | Absolute `EXPO_PUBLIC_API_URL` + `Authorization: Bearer <jwt>` |
| Auth | Google redirect → `/auth/callback` (`src/app/auth/callback/route.ts`); `src/proxy.ts` middleware | `expo-auth-session` (or `WebBrowser.openAuthSessionAsync`) + `tally://auth/callback`; Expo Router auth stack, not Next middleware |
| Theme | CSS vars on `:root` / `[data-theme="dark"]`; `src/lib/theme.ts` writes `document` + `localStorage` | Light/dark **hex objects** + `Appearance` / AsyncStorage; `StatusBar` / `expo-system-ui` |
| Clipboard | `src/lib/clipboard.ts` — Clipboard API + `execCommand` fallback | `expo-clipboard` |
| Share | `navigator.share` in `InviteGroupSheet` | `Share.share` / `expo-sharing` |
| Query focus | `refetchOnWindowFocus: true` in `src/app/providers.tsx` | `AppState` `'active'` → `queryClient.invalidateQueries`. Keep `staleTime: 60_000` and `refetchOnMount` |
| Invite / claim URLs | `window.location.origin` | `EXPO_PUBLIC_WEB_ORIGIN` (the deployed Next origin, so copied links still open the web fallback) |
| Images | `next/image` in `src/components/Avatar.tsx` | `expo-image` |
| Icons | `lucide-react` | `lucide-react-native` |
| Sheets | Vaul + `createPortal` + `document.body` | `@gorhom/bottom-sheet` or RN `Modal` |
| Dates | `react-day-picker` + portal (`src/components/DatePicker.tsx`) | Native `DateTimePicker` |
| Popovers | `src/lib/usePopoverPosition.ts` | Drop — action sheets instead |

### `postJson` and the BFF

These routes must stay on the Next server (service-role, rate limits):

| Endpoint | Why not the anon client |
|---|---|
| `POST /api/groups/create` | Creator + invitees in one privileged write; rate limit |
| `POST /api/groups/members/add` | Same member semantics on an existing group |
| `POST /api/groups/members/remove` | Privileged remove |
| `POST /api/groups/members/claim-invite` | Assisted guest claim; name resolved server-side |
| `POST /api/invite/decline` | Delete vs convert-to-guest; must not cascade splits |

`POST /api/ocr` is a Phase 3 stub — web-only until receipt scanning exists.

Today `postJson` uses a relative path and relies on cookies. Native needs
`postJson(path, body, { origin, accessToken })` (or a factory closed over
those). Web can keep calling with `origin: ''`.

This is not just a client-side signature change. All six routes above
authenticate today via `createServerSupabaseClient()` reading the session
cookie, then `supabase.auth.getUser()` — confirmed by reading
`src/app/api/groups/create/route.ts`. None accept a bearer token. Each route
needs a second auth path (verify the `Authorization: Bearer <jwt>` header,
e.g. `supabase.auth.getUser(token)` against a plain `createClient()`) added
server-side before native can call it. Budget this as real backend work, not
a wrapper.

### Tokens

`src/design/tokens.ts` currently aliases CSS variables:

```ts
bg: 'var(--tally-bg)',
```

RN `StyleSheet` does not resolve that. Lift the hex palettes already in
`src/app/globals.css` (`:root` and `[data-theme="dark"]`) into TS `light` /
`dark` objects. Web CSS should eventually be generated from — or at least
kept in lockstep with — those objects. Radius numbers (`T.r`) and
`AVATAR_SLOTS` are already numeric and share cleanly; shadows become
platform-specific (`boxShadow` vs RN `shadow*` / `elevation`).

Inline `style={{}}` on web looks RN-like but uses CSS shorthands RN rejects
(`padding: '12px 14px'`, `border: '1.5px solid …'`, `boxShadow`, `cursor`,
`transition`, `textOverflow`). Primitives (`Btn`, `Card`, `Avatar`, and since
2026-08-19 `Token`/`PersonToken`, `Input`, `Segmented`) are templates, not
shareable components.

**The tactile depth system is the hard part of this section.** Web expresses
all four tiers as multi-layer `box-shadow` (see `design-system.md`), and RN has
no equivalent — iOS gets a single `shadow*` set, Android only `elevation`, and
**neither supports inset shadows at all**. So:

- *Raised* ports approximately (one outer shadow, losing the inner light edge).
- *Recessed* has no native equivalent — `Input`'s wells need a redesign for
  native (a filled surface plus a border is the usual substitute), not a port.
- The press interaction ports cleanly and is worth keeping: it's a
  `translateY(1px)` plus a shadow swap, which maps to `Pressable` + a style
  function.
- The two web-only animation workarounds (equal-length shadow lists, gradients
  that can't interpolate to solids) are CSS artifacts. Don't carry them over —
  and don't delete them from web while porting, they're load-bearing there.

The sidebar rail does not port: it's desktop-only, and its state deliberately
lives in a pre-paint `data-sidebar` attribute + CSS rather than React (see
`features.md` → "Sidebar rail"). Native's shell is `DockedTabBar`.

---

## 3. Expo Router map

Native v1 = current mobile web. Route IDs match the Next paths so universal
links and mental models stay aligned.

### Auth stack

| Expo | Next today |
|---|---|
| `app/(auth)/login.tsx` | `src/app/login/page.tsx` |
| `app/(auth)/onboarding.tsx` | `src/app/onboarding/page.tsx` |
| `app/auth/callback.tsx` | `src/app/auth/callback/route.ts` — deep-link code exchange |

Unauthenticated users land on login; authenticated users with `handle ===
null` land on onboarding. That logic lives in the root layout / a navigation
guard, not Next `proxy.ts`.

### Tabs

Shell is `DockedTabBar` (`src/components/DockedTabBar.tsx`), not `Sidebar`.
Tab ids come from `src/components/nav/navTabs.ts`.

| Expo | Next today |
|---|---|
| `app/(tabs)/index.tsx` | `/` — Home |
| `app/(tabs)/groups/index.tsx` | `/groups` |
| `app/(tabs)/activity.tsx` | `/activity` |
| `app/(tabs)/me.tsx` | `/me` |

Center Add → group picker (today `AddExpenseGroupPicker` via Zustand
`fabOpen`). Group detail keeps its own Add Expense control, same as web.

`TabBar.tsx` (floating pill) is unmounted on web and is not the native
target.

### Stack (outside tabs, back-button headers)

| Expo | Next today |
|---|---|
| `app/groups/new.tsx` | `/groups/new` |
| `app/groups/[id]/index.tsx` | `/groups/[id]` — `?add=1` opens the add-expense sheet |
| `app/groups/[id]/settings.tsx` | `/groups/[id]/settings` |

`/groups/[id]/add` on web is a legacy redirect to `?add=1`. Native does not
need that route.

### Universal links

Web pages stay for cold traffic (no app installed, desktop). The app
intercepts when installed:

| Expo | Next today | Auth |
|---|---|---|
| `app/invite/[token].tsx` | `/invite/[token]` | Sign in, then auto-join |
| `app/claim/[token].tsx` | `/claim/[token]` | Sign in, then claim guest seat |
| `app/add/[add_code].tsx` | `/add/[add_code]` | Signed-in; pick a group to add that person |

Copied invite/claim links should still be `https://<web-origin>/invite/…`
so they work in Messages without the app.

### Stay web-only

- `/expense/[share_token]` — public read-only split view (skeleton today)
- `/api/ocr` — Phase 3
- `/__preview`, `/devpreviewxyz` — local design sandboxes
- Desktop: `Sidebar`, home-rail, `ProfileMenuPopover`, `EmojiPopover`,
  `usePopoverPosition`, `DesktopPanel`

### Sheets stay overlays, not routes

Same contract as web (`ModalOrSheet` → always a sheet on native):

- Add expense (`AddExpenseSheet` / `useAddExpenseForm`)
- Group picker (`AddExpenseGroupPicker`)
- Settle up (`SettleUpSheet`)
- Notifications list + review (`NotificationsSheet`)
- Expense detail / edit / delete (`ExpenseActionSheet`)
- Member actions + guest claim (`MemberActionSheet`)
- Invite link (`InviteGroupSheet`)
- Home balance / person (`BalanceSheet`, `PersonProfileSheet`)
- Leaderboard (`LeaderboardSheet`)
- Delete group (`DeleteGroupSheet`)
- Emoji picker (`EmojiPickerSheet` — not the desktop popover)

---

## 4. Native v1 feature checklist

Parity with mobile web, using the shared hooks. Desktop treatments are out
of scope.

**In:**

- Auth — Google + password / dev login; handle onboarding
- Home — hero, per-person rows, `BalanceSheet` / `PersonProfileSheet`
- Groups — list, create, detail (feed, balances, members, leaderboard)
- Add expense — equal / exact / percentage via `useAddExpenseForm` + mobile layout
- Edit / delete expense (no split-membership editor — same as web)
- Settle up + confirm / deny, including notification review
- Invites — search add, invite-link copy/share, accept/decline, guest claim (self-serve + assisted), add-code destination
- Activity tab
- Me — display name, handle, theme, `add_code` display, sign out
- Group settings — rename, members, leave, delete
- Reactions on expense detail (`useExpenseSocial`)
- Pull-to-refresh — already in the product spec (`invalidateQueries`); native should ship it even though mobile web does not

**Out (same gaps as web, plus desktop-only chrome):**

- Itemized splits and receipt OCR
- Public expense share page
- Edit-history viewer (`expense_history` is written, no UI)
- Cross-group "settle all with [person]"
- 30s bell poll (optional follow-up; list still uses `refetchOnMount`)
- Sidebar, popovers, two-column add-expense, home rail

QR: `qrcode.react` is a web dependency and unused. Native Me can show a QR
of the add-code URL with `react-native-qrcode-svg`; scanning is
`expo-camera` / a system scanner hitting `/add/[add_code]`. Neither blocks
v1 if the code string + share link work.

---

## 5. What not to do

- **PWA instead of native** — mobile web already exists (tab bar, safe-area
  padding). It does not give camera QR, a system share sheet, or App Store.
  Fine as a stopgap; not this plan.
- **`react-native-web` of current components** — CSS vars, shorthands,
  portals, Vaul, Next Image, and the desktop shell will fight the whole way.
- **Service role in the app** — that key must never ship.
- **Sharing `Btn` / `Card` via a compatibility layer** — cheaper to rewrite the
  primitives than to polyfill CSS, and more so now that they carry multi-layer
  and inset shadows RN cannot express.
- **Changing the query model for native** — do not add Realtime, polling on
  expense queries, or a stored balance. See `CLAUDE.md` sync strategy.

---

## 6. Later implementation sequence

When code work starts, this order. Each step should leave web shipping.

1. **Tokens as hex objects** — `light` / `dark` in TS; web can keep CSS vars
   pointing at the same values.
2. **Injectable `createClient` + `postJson(origin, jwt)`** — web still uses
   cookies and relative URLs; the signatures become native-safe.
3. **Strip `next/navigation` from `useAuth`** — callbacks from the UI.
4. **Extract `packages/core`** (or `src/core/` if the monorepo is deferred) —
   types, pure lib + tests, query hooks, token objects.
5. **Scaffold Expo** — auth stack + tabs + one live screen (groups list) to
   prove adapters: session persist, a real query, a privileged `postJson`.
6. **Remaining screens, sheets, universal links** — Home, group detail,
   add expense, settle, invites, Activity, Me, settings.

Highest-leverage web changes before an Expo repo exists are steps 1–3.
They pay off even if native slips.

Start this sequence after [audit-fix-plan.md](./audit-fix-plan.md) phases
1–4 ship (RLS + atomic expense/settlement writes), not before. Step 2 above
builds the native write path against `settlements` INSERT and expense
create/edit; if those move to SECURITY DEFINER functions while native
adapters are mid-build, the adapter work gets redone.

---

## 7. Effort estimate (2026-08-16)

No further core-extraction discovery needed — the shared-core inventory in
section 1 is already complete against the current tree (2,610 lines of pure
`lib`, 37 exported hooks across 1,213 lines of `queries`, a 232-line
`types/index.ts`). What remains is adapter work already scoped above, plus
the screen rewrites in section 3/4. Assumes a solo developer already fluent
in this codebase, starting after the audit-fix-plan phases above ship.

| Phase | Work | Estimate |
|---|---|---|
| Steps 1–4 | Hex tokens, `postJson(origin, jwt)` + dual auth (cookie *and* bearer) on all 6 API routes, strip `router.push` from `useSignInWithPassword`/`useSignOut`, move `src/core/` | ~1.5–2 weeks |
| Step 5 | Scaffold Expo, deep-link auth (`expo-auth-session`, `tally://` scheme), token storage, one live screen (groups list) | ~1–2 weeks — highest first-time risk if this is a new Expo setup |
| Step 6 | Rewrite screens/sheets: 14 route-equivalents (section 3) + ~11 in-scope sheets, each with real native gesture/picker/share-sheet work, not just layout | ~4–6 weeks — dominates total cost |
| Store submission | Icons, TestFlight, Play Console, review cycles | +1–2 weeks calendar time, runs partly in parallel with step 6 polish |

**Total: ~8–12 weeks of solo focused effort** to reach the section 4 "Native
v1" feature list, live on both stores. Logic reuse (steps 1–4) saves real
time, but it does not shrink step 6 much — every sheet, date picker,
camera/QR flow, and share sheet is rebuilt against native primitives, not
ported.
