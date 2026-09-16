# Statement Import Design

**Plan, not as-built.** Nothing here is built. `src/app/api/ocr/route.ts` is a
stub returning 501, and no extraction code, schema change, or UI exists yet.
Written 2026-09-15.

## The Problem

A user arrives at Tally with a backlog. The shared costs already exist — they
are sitting in their banking app as a list of transactions — and the current
add-expense flow makes them retype each one by hand, one form at a time. For
anything more than three or four expenses, that is enough friction to make
someone close the app and go back to a group chat and mental arithmetic.

The goal: let a user screenshot their transaction list, upload one to four
images, and get a reviewable set of import candidates they can accept in a
single pass.

---

## This Is Not Receipt Scanning

The roadmap already carries receipt OCR as a Phase 3 item (`tally-roadmap.md`,
`/api/ocr`). Statement import is a **different feature that shares the
extraction endpoint**, and conflating the two produces a flow that serves
neither.

| | Receipt scan | Statement import |
|---|---|---|
| Input | one bill | one transaction list, 10–30 rows |
| Output | **1 expense, N line items** | **N expenses, 1 simple split each** |
| Split type | `itemized` | `equal` (usually) |
| Hard part | assigning items to people | deciding which rows are shared at all |
| Reuses | `ItemComposer`, itemize flow | nothing — needs a new staging screen |

They diverge at the first branch: a receipt produces one expense whose *items*
need assigning; a statement produces many expenses most of which should be
**discarded**. On a bank statement the majority of rows are the user's own
spending — rent, subscriptions, petrol. Perhaps four of twenty-two are shared.

Consequence for the UI: **rows are unchecked by default.** Opt-in beats making
someone un-tick eighteen rows, and it means a poor extraction costs the user
nothing but a glance.

---

## Architecture: Vision-First, No Separate OCR

The extraction step hands the screenshot **directly to a multimodal model**.
There is no Tesseract/Textract/Cloud Vision stage producing text first.

```
user selects screenshots
      |
client-side resize (canvas -> JPEG, 1568px long edge)
      |
POST /api/ocr — one request per image, fired in parallel
      |
vision model: prompt + image bytes -> JSON text
      |
parse + Zod validate (retry once on failure)
      |
normalize merchant · dedupe within batch and against existing expenses
      |
staging list — all rows unchecked, per-row member assignment
      |
one atomic RPC -> N expenses + splits
```

**Why not OCR then LLM.** The screenshot's *layout carries meaning*. In a
banking app, a merchant name, its category subtitle and its amount are one
transaction because they are visually grouped, not because of anything in the
text stream. Flattening to text first discards exactly the signal that makes
the grouping correct, and adds a second system to operate and debug before we
know whether we need it. OCR stays available as a later fallback if vision
accuracy proves insufficient — or as a preprocessing step for hard screenshots
only.

**Why one request per image** rather than all images in one call: each image
can be retried independently, failures are isolated, every extracted row
carries a `source_image_index` for provenance, and no single request
approaches the request-body cap. The cost is identical — the same pixels are
billed either way.

---

## Provider Abstraction

Provider choice must be swappable: Gemini now, a self-hosted VLM once the
homelab server exists. The abstraction that achieves this is **one function
type**, because that genuinely is the shared contract — every vision model
takes a prompt plus image bytes and returns text.

```ts
// src/lib/extract/providers.ts
type VisionCall = (
  prompt: string,
  img: { bytes: Buffer; mime: string },
) => Promise<string>
```

Two implementations, roughly twenty lines each:

- **`gemini`** — `@google/genai`, `client.interactions.create({ model, input })`
  with a `{ type: 'image' }` input block. Passes the JSON Schema natively via
  `response_format` as belt-and-braces; the prompt carries it too.
- **`local`** — plain `fetch` against an **OpenAI-compatible
  `/v1/chat/completions`** endpoint, image as a `data:` URI in an `image_url`
  content block, configured by `LOCAL_VLM_URL` + `LOCAL_VLM_MODEL`.

Writing the local provider against the OpenAI-compatible wire format rather
than any one server's native API is the highest-leverage decision here: one
provider file then covers Ollama, vLLM, llama.cpp's server, LM Studio and TGI,
so choosing or changing the serving stack later is an env var, not a rewrite.

Selection is `EXTRACT_PROVIDER=gemini|local`, with a per-call override so a
comparison harness can run both over the same fixtures without env juggling.

### What deliberately stays out of the provider

**Validation.** The provider returns a `string`. The core extracts the JSON
block (stripping code fences and any preamble), `JSON.parse`s it, and runs the
Zod schema — identically for every provider. Neither response is trusted:
Gemini's is schema-enforced server-side and still gets validated; the local
model's may arrive fenced, prefixed with prose, or with `"amount": "8.42"` as
a string. On validation failure, retry once with the error appended to the
prompt. Gemini simply never reaches that path.

Rejected: an `enforcesSchema` capability flag letting the core skip the repair
path for strong providers. It buys nothing — defensive parsing is required
regardless, so the flag only adds a branch.

**Per-provider prompts.** One prompt, strict enough for a 7B — output only
JSON, no preamble, schema inline, one worked example row. A strict prompt costs
a strong model nothing, so there is no reason to maintain two.

**Token/cost normalization.** Gemini bills per 768x768 tile; a self-hosted
model bills electricity. These do not unify into a comparable number. Log the
raw usage opaquely and let each provider compute its own cost if it can.

### The one asymmetry that is real

**Input resolution.** Gemini tiles a 1170x2532 screenshot happily. A local VLM
with a fixed input size may squash a tall statement until the amounts are
unreadable, and the fix is slicing the image into overlapping vertical bands
and merging the rows. This is *not* an interface problem — the interface
returns rows, so a provider may fan out internally — and it should not be built
for in advance. It will surface within minutes of pointing the code at a local
server, and gets fixed inside `local` without touching anything else.

---

## Provider Decision

**Gemini (Google AI Studio) now; self-hosted evaluated later on measured data.**

Reasoning:

- **Cost runs the opposite way to intuition at this scale.** Bursty,
  low-volume, per-user-action inference is where per-call pricing wins. A GPU
  box idling 24/7 costs more in electricity than a few thousand extractions.
  Self-hosting breaks even at tens of thousands of calls a month.
- **Quality risk sits exactly where small VLMs are weakest.** Dense tabular
  extraction with layout-driven grouping is the hardest thing to ask of a 7B.
  And the failure mode is silent: a wrong amount does not throw, it becomes an
  `expense_splits` row and someone pays the wrong person. The review UI is the
  defence, but nobody carefully verifies thirty-eight rows — they skim.
- **The homelab server does not exist yet**, and serving it to Vercel adds a
  tunnel, a dynamic IP and uptime we own — for a project that needs to be
  clickable by a stranger.

### Free tier trains on your data

Google's **unpaid** Gemini API tier may use inputs and outputs to improve
Google's products, including human review. The **paid** tier does not. A
banking screenshot contains the user's balance, account digits and a wall of
unrelated private transactions.

**Rule: the free tier is for spiking against our own statements only. Billing
must be enabled before a second person's screenshot goes through this.**

Also relevant: Pro models were removed from the free tier in April 2026 (Flash
and Flash-Lite only), and free-tier limits are roughly 5–15 requests/minute and
~1,000/day — workable for a spike, a hard ceiling for a multi-user feature.

### Self-hosting is not closed off

The point of `VisionCall` is that the question stays answerable. As screenshots
are tested, each is saved with its hand-corrected expected JSON. Twenty of
those is a fixture set, and `vitest` is already installed. When the server
exists, the same fixtures run against both providers and produce a table: rows
found, amounts exact, dates exact, latency, cost. The decision becomes measured
rather than a matter of taste.

**Do not build that harness yet.** It earns its keep at the second fixture that
disagrees with the first, not before.

---

## Extraction Contract

```ts
// src/lib/extract/schema.ts — single source of truth
const Txn = z.object({
  date:     z.string(),                      // as printed; normalized later
  merchant: z.string(),
  amount:   z.number(),
  type:     z.enum(['debit', 'credit']),
  pending:  z.boolean(),
  raw_text: z.string(),                      // what the model actually read
})
const Result = z.object({ transactions: z.array(Txn) })
```

The Zod object is the only schema definition. `z.toJSONSchema(Result)` produces
the JSON Schema sent to providers that accept one, and the same object
validates the response — no drift between what was asked for and what is
checked.

Prompt requirements: extract every visible transaction; do not infer anything
not visible; do not merge transactions; return only JSON.

`raw_text` is not decoration. Checking that the digits of `amount` actually
appear in `raw_text` is a cheap and effective hallucination check.

### Validation is plausibility, not shape

Shape is handled by Zod. The interesting layer runs after:

- `expense_date` within the last 18 months and not in the future
- `amount` above zero and below a sanity ceiling
- digits of `amount` present in `raw_text`
- `pending: true` rows flagged — pending transactions change amount or vanish
- rows failing any check are surfaced as "needs attention", never silently
  dropped

---

## Deterministic Processing

**Merchant normalization.** `STARBUCKS #1234`, `Starbucks`, and
`STARBUCKS STORE 1234` collapse to one representation for dedupe and display.
Strip store numbers, trailing location codes, and card-processor noise.

**Dedupe.** Fingerprint on
`(group_id, normalized_merchant, amount, expense_date ± 3 days)`, checked both
*within* the uploaded batch — overlapping screenshots are the normal case — and
*against existing group expenses*, which catches collisions with expenses
someone already entered by hand.

Matches are **flagged, never auto-skipped** ("possible duplicate — already
added by Sam"). Identical repeat charges are real: two coffees, same price,
same week.

**Defaults that fall out of the domain.** `paid_by` = the uploader, because it
is their card. `expense_date` from the row, **not** `CURRENT_DATE` — these are
historical. `category` from the existing keyword matcher in
`src/lib/categories.ts`, no API call needed. Split = equal across active
members, overridable per row.

---

## Schema Changes

No new tables. Following the `settlements.batch_id` precedent
(`20260808000000`) — identity carried as a **stamp, not a table**:

```sql
ALTER TABLE expenses
  ADD COLUMN source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'receipt', 'statement')),
  ADD COLUMN import_batch_id uuid;   -- NULL for manually-entered expenses
```

`import_batch_id` buys "undo this entire import" as a single statement —
`UPDATE expenses SET deleted_at = now() WHERE import_batch_id = $1` — which
respects the soft-delete invariant and removes the rows from every balance
calculation at once. `source` gives provenance for the activity feed and for
debugging bad extractions after the fact.

**Commit path.** A `SECURITY DEFINER` RPC, `import_expenses(group_id, rows
jsonb)`, for the same reason `confirm_settlement_batch` exists: N expenses plus
N×M splits must not half-apply. Split amounts go through `src/lib/splits.ts` so
the **split-sum invariant** (amounts sum exactly to the expense total, remainder
to `paid_by`) holds per expense.

**No `staged_expenses` table.** Staging lives in component state for v1;
navigating away loses the batch. Add persistence only if people complain about
losing work — it is a table, an RLS policy and a cleanup job otherwise spent on
nothing.

### Rate-limit counter

`isOverLimit` in `src/lib/rateLimit.ts` works by counting rows in an existing
table over a time window. Extraction creates no row until the user commits, so
it needs something to count:

```sql
CREATE TABLE ocr_calls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

One row per extraction request, then `isOverLimit` works unchanged.

---

## Privacy — Hard Rules

A banking screenshot contains the user's balance, partial account numbers, and
a wall of transactions that are nobody else's business. These are not
preferences:

1. **The image is never persisted.** Processed in memory, discarded when the
   request ends. No Supabase Storage, no `/tmp`, no logging of image bytes.
2. **The image is never attached to an expense**, and therefore can never reach
   a public `share_token` page.
3. **Only the checked rows are ever written.** Unchecked rows — the user's
   private spending — leave no trace anywhere in the database.
4. **The upload UI says so in one line** ("we read the image and discard it —
   nothing is stored") and suggests cropping to the relevant rows.
5. **Paid API tier before anyone else's screenshot.** See the free-tier warning
   above.

A free expense app that leaks bank screenshots does not get a second chance.

---

## Repo Integration Points

- **`src/app/api/ocr/route.ts`** — currently returns 501. Becomes the
  extraction endpoint; accepts one image per request.
- **Auth.** `src/proxy.ts` (Next.js 16's rename of `middleware.ts`) has a
  matcher covering `/api/*`, so an anonymous request is redirected to `/login`
  before reaching the route. The route still needs its own
  `supabase.auth.getUser()` to identify the caller — see
  `src/app/api/groups/create/route.ts:15` for the established pattern — and it
  needs a rate limit, because the proxy stops anonymous traffic but not a
  signed-in user hammering the endpoint.
- **Vercel caps request bodies at 4.5 MB**, which is the binding constraint
  (Gemini itself permits 20 MB inline). Hence client-side resize before upload;
  four full-size PNGs would exceed it.
- **`src/lib/splits.ts`** — all split construction routes through it.
- **`src/lib/categories.ts`** — `detectCategory` for per-row category guesses.
- **`src/lib/rateLimit.ts`** — `isOverLimit`, needs the `ocr_calls` table above.
- **`CLAUDE.md` drift.** The spec says `/api/ocr` "proxies to homelab Ollama
  (Phase 3)". That is now wrong in two ways — hosted Gemini, and statement
  import is a distinct feature from receipt OCR. Update when this ships.

---

## Build Order

| # | Step | Size |
|---|---|---|
| 0 | **Spike.** `npm i @google/genai zod`, key in `.env.local`, ~40-line scratchpad script: one real screenshot in, JSON out. No route, no UI, no migration. | 30m |
| 1 | `src/lib/extract/` — `schema.ts`, the prompt, `providers.ts` with `gemini`, JSON-block extraction, validate-and-retry-once | 2h |
| 2 | `/api/ocr` — auth, `ocr_calls` migration + rate limit, one image per request | 2h |
| 3 | Client-side resize — canvas to JPEG, 1568px long edge | 1h |
| 4 | Normalize + dedupe + plausibility checks — pure functions, unit tested | 3h |
| 5 | **Staging/review UI** — the actual feature | days |
| 6 | Migration (`source`, `import_batch_id`) + `import_expenses` RPC | 3h |
| — | *Later:* `local` provider + fixture comparison harness | — |

Step 0 is the gate. The only question it answers is whether a vision model
reads **this specific bank's layout** accurately enough that the review screen
is a formality rather than a data-entry screen. Everything downstream is wasted
work if the answer is no — so it happens before the abstraction, before the
migration, before any UI.

Steps 1–4 are roughly a day. Step 5 is where this feature actually lives: a new
screen with real interaction design, not a form.

---

## Open Decisions

1. **Entry point.** Group-scoped importer (FAB inside a group) or a global
   importer that routes rows to different groups? Global is more useful and
   considerably harder — it needs a per-row group picker and cross-group
   dedupe. *Leaning: group-scoped for v1.*
2. **Currency.** Trust the symbol printed in the screenshot, or force the
   group's currency? Rows arrive with `$`/`£` inline and mixed-currency imports
   are a mess. The schema stores `currency_code` per expense, so either is
   representable.
3. **Pasted text as a second input path.** Many banking apps allow copying a
   transaction list. Same prompt, no image tokens, better accuracy, far cheaper
   — plausibly the best reliability-per-effort win available. But it is a second
   input mode to design and validate.
4. **Pending transactions.** Flag, exclude, or import? A pending row's amount
   can still change.

---

## Rejected Alternatives

**OCR engine then LLM parser.** Adds a system before we know it is needed, and
discards the layout signal that makes transaction grouping correct. Available
later as a fallback.

**Bank API integration (Plaid or similar).** Real per-connection cost, which
conflicts directly with Tally being free; heavy compliance surface; and vast
overkill when the app only needs the handful of transactions that happen to be
shared.

**CSV/OFX statement export.** More reliable than any vision model, but it is a
desktop-shaped workflow. Nobody exports a CSV on their phone at a restaurant.
Worth accepting as an extra path eventually, not as the primary one.

**A `staged_expenses` table.** Persisting the review list across sessions costs
a table, an RLS policy and a cleanup job to solve a problem nobody has reported.
Component state until proven otherwise.

**A general LLM-provider interface** (streaming, chat, tool use, normalized
usage accounting). One domain method, one purpose. Two signs of overshoot: the
interface grows a third method, or we start normalizing token shapes across
providers.
