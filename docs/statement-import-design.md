# Statement Import Design

**Plan, not as-built.** Nothing here is built. `src/app/api/ocr/route.ts` is a
stub returning 501, and no extraction code, schema change, or UI exists yet.
Written 2026-09-15. Revised 2026-09-16: Gemini tier mechanics and real costs,
ZDR, three-layer rate limiting, image-token math, extract-twice-and-diff, PDF
input, and a re-examination of the OCR alternative against current homelab
state. The vision-first architecture is unchanged.

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

Worth knowing while reasoning about that cost, because it is counter-intuitive:

- Images ≤ 384px on both sides cost a flat **258 tokens**. Larger ones are
  `crop_unit = floor(min(w,h) / 1.5)`, then `ceil(w/unit) × ceil(h/unit)` tiles
  at 258 tokens each.
- Because the crop unit derives from the *short* side over 1.5, the short side
  is always exactly 2 tiles. The whole formula collapses to
  `2 × ceil(1.5 × aspect_ratio)` tiles — so **above 384px, token count depends
  only on aspect ratio, not resolution.** A 1170x2532 screenshot and the same
  image at 725x1568 both cost **2,064 tokens**.
- **Output dominates.** ~2,064 image tokens against ~1,500 JSON tokens works
  out to roughly 1:4 in favour of output on Flash-Lite. The lever that moves
  the bill is schema verbosity in `schema.ts`, not image resolution.

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

**Decision (2026-09-16): call Gemini directly, paid tier, ZDR requested. Start
on Gemini 3.8 Flash. Self-hosting and OpenRouter both stay open, decided later
on fixtures rather than taste.**

Direct rather than through a router: shortest chain for the most sensitive
payload in the app, native server-side schema enforcement that the extraction
contract leans on, one vendor in a user-facing path, and a privacy note that
fits in one honest sentence.

3.8 Flash rather than Flash-Lite: the delta is ~$12/month at our caps and
accuracy is the entire game. Drop to Flash-Lite only once fixtures show no
difference — do not pre-optimize into the cheaper model and then debug a wrong
`expense_splits` row.

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

### The free tier trains on your data — paid tier is non-negotiable here

Verified against Google's [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), effective 2026-03-23:

On the **unpaid** tier Google *does* use submitted content — not "may" — to
"provide, improve, and develop Google products and services", and "human
reviewers may read, annotate, and process your API input and output". The terms
carry an explicit instruction: **"Do not submit sensitive, confidential, or
personal information to the Unpaid Services."**

On the **paid** tier: "Google doesn't use your prompts (including associated
system instructions, cached content, and files) or responses to improve our
products." Prompts and responses are retained ≤ 30 days, region-pinned, solely
for Prohibited Use Policy enforcement.

A banking screenshot contains the user's balance, account digits and a wall of
unrelated private transactions. Google's own terms tell us not to send it
through the unpaid tier.

**Rule: the free tier is for spiking against our own statements only. Billing
must be enabled before a second person's screenshot goes through this.**

(Regional note: in the EEA, UK and Switzerland the paid-tier data terms apply
to all services including unpaid quota. Irrelevant while we ship to the US,
relevant if the spike is ever region-scoped.)

### What "paid tier" actually is

Not a plan or a subscription — a property of the Google Cloud **project**. Link
an active billing account to the project holding the API key and it flips to
Tier 1 essentially instantly. No minimum, no monthly fee, no token blocks to
buy: pricing is *quoted* per 1M tokens but billed fractionally per token.

The data terms land at Tier 1. Tier 2 ($100 cumulative + 3 days) and Tier 3
($1,000 + 30 days) only buy throughput.

| | Free | Paid (Tier 1) |
|---|---|---|
| Training on input | Yes, plus human review | **No** — contractual |
| Retention | Unbounded for us | ≤ 30 days, abuse detection only |
| ZDR available | No | Yes, by request |
| Rate limits | ~5–15 RPM, ~1,000/day | Higher, plus $10 per rolling 10 min spend cap |
| Models | Flash / Flash-Lite only | All |

One billing account can back several projects, each with its own key and tier
status — so the same account covers other projects. **Keep Tally in its own
project**: quotas and keys are per-project, so a runaway script elsewhere
cannot eat this feature's throughput or leak its key.

**Zero Data Retention** is available on the Gemini Developer API by request
([docs](https://ai.google.dev/gemini-api/docs/zdr)), not just on Vertex.
Approved projects get prompts, responses and identifying metadata cleared
before logging, which closes the 30-day window. Worth requesting before real
users, since the payload here is bank screenshots.

### What it costs

Paid pricing per 1M tokens at time of writing: Gemini 3.5 Flash-Lite $0.30 in /
$2.50 out; Gemini 3.8 Flash $0.75 / $3.75 (promo through 2026-12-31); Gemini
3.5 Flash $1.50 / $9.00.

A phone screenshot is ~2,064 input tokens (see *Token/cost* below) and a
~38-row extraction is ~1,500 output tokens:

| | Per screenshot | 4-image import | 1,000 imports/mo |
|---|---|---|---|
| Flash-Lite | ~$0.004 | ~$0.018 | ~$18 |
| 3.8 Flash | ~$0.007 | ~$0.029 | ~$29 |

So the paid tier costs a couple of cents per import and buys the only privacy
posture under which a stranger's bank screenshot can be accepted at all. The
free tier saves ~$20/month and forfeits the ability to make any privacy claim.

### Self-hosting is not closed off

The point of `VisionCall` is that the question stays answerable. As screenshots
are tested, each is saved with its hand-corrected expected JSON. Twenty of
those is a fixture set, and `vitest` is already installed. When the server
exists, the same fixtures run against both providers and produce a table: rows
found, amounts exact, dates exact, latency, cost. The decision becomes measured
rather than a matter of taste.

**Do not build that harness yet.** It earns its keep at the second fixture that
disagrees with the first, not before. But **start collecting fixtures with the
first spike screenshot** — they cost nothing to save and they are what turns
every later provider decision into a measurement.

#### OpenRouter answers the open-model question before the tunnel exists

The blocking question for self-hosting is "is an open VLM good enough?", and it
currently sits behind half a day of network setup. It does not have to.
[OpenRouter](https://openrouter.ai) is OpenAI-compatible, so the existing
`local` provider reaches it with a base URL swap and a bearer header — no new
provider code:

```
LOCAL_VLM_URL=https://openrouter.ai/api/v1
LOCAL_VLM_MODEL=qwen/qwen2.5-vl-72b-instruct
```

Run the spike screenshots through one or two open VLMs alongside Gemini. A few
cents settles whether the self-hosting branch is worth pursuing at all.

**Read the result carefully, because the models are not equivalent.** A hosted
Qwen2.5-VL 72B runs at full precision on datacenter hardware; the homelab would
run a ~7B at Q4 alongside Virgil. So this is an **upper bound on local
quality** — a cheap negative test. Fails hosted ⇒ certainly fails quantized,
branch closed for pocket change. Passes hosted ⇒ less than it looks, because
quantization still has to be tested on the actual card.

Worth knowing separately: that 72B is ~$0.25/$0.75 per 1M in/out, roughly **4×
cheaper than 3.8 Flash** per screenshot. Being open-weight does not make it the
weaker model here — that equivalence only held for the local 7B. If it matches
Gemini on the fixtures it is a legitimate candidate on its own merits, not just
as a homelab proxy.

#### Three things stand between here and a local provider

Reviewed 2026-09-16 against the current homelab state (box assembled and
running, RTX 5060 Ti 16GB, Ollama on GPU passthrough, **no network configured
yet**). The marginal electricity cost of adding extraction to a box that
already runs Virgil, Jellyfin and Immich is effectively zero — that argument
for hosted inference is gone. These three are what remain:

1. **Vercel cannot reach the box, and Tailscale alone does not fix it.** The
   homelab roadmap's network section gets MacBook ↔ server and phone ↔ server.
   A Vercel serverless function is not a device on the tailnet and cannot
   practically become one. The options are Cloudflare Tunnel or Tailscale
   Funnel, and **for this payload they are not equivalent**: Cloudflare
   terminates TLS at its edge and can read what passes through, so routing bank
   screenshots through it re-creates the exact disclosure we left the free tier
   to avoid. Tailscale Funnel terminates TLS on our node — end-to-end
   preserved. If privacy is the reason for self-hosting, it has to be Funnel or
   a tunnel we terminate ourselves. (Caveat: Cloudflare is the only realistic
   option behind carrier-grade NAT — check the ISP before committing.)
2. **The GPU is already spoken for.** 16GB, single x16 slot, no multi-GPU path,
   with Virgil's interactive model resident. A 9B at Q4 (~6GB) plus a 7B-class
   VLM at Q4 (~5GB + vision encoder) plus KV cache is 13–14GB of 16 — possible,
   with no headroom. If both cannot stay loaded, Ollama evicts, and a statement
   import stalls Virgil for 10–20s. Q4 is also the wrong quantization for our
   failure mode: a misread digit becomes an `expense_splits` row.
3. **Latency.** At ~448 GB/s memory bandwidth a 7B Q4 gives ~50–70 tok/s, so a
   ~1,500-token extraction is **25–35s** plus any model swap, against Gemini's
   3–8s — on a flow where the user is watching an upload spinner.

None of this is permanent, and none of it argues against self-hosting in
principle. It argues for shipping on Gemini and keeping `local` warm.

**If it does move local, build it as a Virgil capability, not a bespoke
endpoint.** Virgil is already the AI orchestration layer; extraction is an
orchestration job. That way the tunnel, auth and rate limiting get built once
for every future Tally ↔ homelab call, and the model choice lives behind
Virgil's agent registry instead of being hardcoded here. The `local` provider
already targets an OpenAI-compatible endpoint, so vLLM, Ollama and llama.cpp
are all drop-in.

A publicly-reachable endpoint accepting images and running inference is the
same abuse target as the hosted one, pointed at the house. Shared secret
minimum, plus the rate limiting below — where a global cap now protects the
GPU and Virgil's responsiveness, not just a card.

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

### Targeting the review screen: extract twice, diff

The review UI is the defence against a silently wrong amount, but nobody
carefully verifies thirty-eight rows — they skim. Spreading attention evenly
across rows that are almost all correct is the failure.

Run the extraction **twice and diff the results**. Rows that agree across both
passes are probably fine; rows that disagree get flagged, and the user's
attention goes exactly where the risk is. At ~$0.007 a call that is 1.4 cents
instead of 0.7 — noise at our volumes, and it buys a materially better review
screen than highlighting nothing.

Worth first checking whether the chosen model exposes logprobs, which would
give per-token confidence more cheaply than a second call. The diff works
either way, and unlike OCR confidence scores it costs us no architecture.

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

### Rate limiting needs three layers, not one

A per-user cap bounds *a user*, not the bill. Exposure is
`users × per_user_cap`, and with open Google sign-up the first term is
unbounded. Tier 1's only platform guardrail is the $10-per-rolling-10-minutes
spend cap, which works out to a theoretical **$1,440/day** — a sanity check for
Google, not protection for us.

1. **Per-user daily cap** — `ocr_calls` + `isOverLimit`, as above. Note the
   table is one row per *image*, not per import, so express the cap in images:
   a 4-screenshot import burns 4.
2. **Global daily circuit breaker** — same table, count all rows for the day,
   refuse past a threshold. This is the layer that actually protects the card,
   and the one this design was missing.
3. **GCP budget hard-stop** — with a footgun: budget alerts only send email by
   default. To actually halt spend, wire budget → Pub/Sub → Cloud Function that
   disables billing on the project. Set this up during the spike, not after.

Starting numbers: **10 images/user/day, 150 images/day globally.** At ~$0.007
an image that is a ~$1/day worst case — deliberately tight enough to shrug at,
and trivially raised once `ocr_calls` shows real usage.

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
5. **Paid API tier before anyone else's screenshot**, with ZDR requested. See
   *The free tier trains on your data* above.
6. **A global daily cap, not just a per-user one.** See *Rate limiting needs
   three layers*. This bounds blast radius as well as spend.

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
| 0 | **Spike.** `npm i @google/genai zod`, key in `.env.local`, ~40-line scratchpad script: one real screenshot in, JSON out. No route, no UI, no migration. Save each screenshot with hand-corrected expected JSON — fixtures start here. | 30m |
| 0a | **Open-model read.** Same screenshots through Qwen2.5-VL 72B on OpenRouter (base-URL swap on the `local` provider). Few cents; tells us whether the self-hosting branch is worth pursuing, and gives a second opinion on the rows. | 30m |
| 0b | **Enable billing** on the Gemini project, request ZDR, wire the budget → Pub/Sub → disable-billing hard-stop. Before any screenshot that is not ours. | 1h |
| 1 | `src/lib/extract/` — `schema.ts`, the prompt, `providers.ts` with `gemini`, JSON-block extraction, validate-and-retry-once | 2h |
| 2 | `/api/ocr` — auth, `ocr_calls` migration + rate limit, one image per request | 2h |
| 3 | Client-side resize — canvas to JPEG, 1568px long edge. Justified by Vercel's 4.5 MB body cap, **not** by token cost — see *Token/cost* | 1h |
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

Step 0b is not optional and not deferrable: the moment a screenshot that is not
ours goes through an unpaid key, it has been handed to Google for training.

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
5. **PDF statements as an input path.** Gemini bills a PDF page at 258 tokens,
   and on Gemini 3 models **native text extracted from the PDF is not charged
   at all** — it arrives as exact characters while the model still sees the
   rendered page for layout. Limits are 50 MB / 1,000 pages, inline or File
   API. That is cheaper *and* removes the misread-digit risk entirely for
   anyone who has a real statement rather than a screenshot. Screenshot-first
   is still right for UX — people have the banking app open, not a downloaded
   PDF — but "or drop in the PDF" is a small addition with an outsized
   accuracy win. Sits naturally alongside decision 3 (pasted text).

---

## Rejected Alternatives

**OCR engine then LLM parser.** Reconsidered in depth 2026-09-16 and rejected
again, now for reasons worth recording so it does not get relitigated:

- *The original objection needs refining.* "Flattening to text discards layout"
  is true of the plain text output, which does scramble columns — but OCR
  engines return per-word bounding boxes and confidence (Tesseract TSV/hOCR,
  PaddleOCR). Emission order stops mattering because row pairing is re-derived
  from y-overlap. Reading order is recoverable; the objection is really about
  flattening to a *string*, not about OCR.
- *Grouping is the part that does not survive.* Geometry gives coordinates, not
  semantics. Wrapped item names, lines with no price, and near-equidistant
  amounts all need the grouping inference back, and gap-clustering heuristics
  are per-layout: they work on one bank's app and break on a different bank,
  dark mode, or a larger accessibility font. **The model's real job is parsing
  layouts we have never seen**, which is exactly what a public app faces.
- *The input is universal, and that decides it.* A banking screenshot is
  rendered text — perfect contrast, no skew, consistent fonts — the easiest
  input OCR ever gets. A photographed receipt is thermal paper with curl,
  glare and fading, which is the input that gave OCR its reputation. One
  extraction path serves both, so it has to be the one that tolerates the
  harder case.
- *The gains were small anyway.* Output tokens dominate, so dropping the image
  saves ~14% of a call. Not a reason to operate a second system.

What was worth salvaging from the exercise is folded in above: OCR's per-token
confidence scores were the genuinely attractive property, and *extract twice
and diff* delivers the same targeted review screen without the architecture.

Client-side OCR was also considered as a privacy layer — the image never
leaving the device, with row selection happening before transmission. It fails
on the same point: selection can only precede the model call if rows can be
built without it.

**OpenRouter as the production path.** Not rejected on privacy — it is
non-retaining by default ("your prompts are not retained unless you
specifically opt in to prompt logging") and `provider.zdr: true` restricts
routing to zero-retention upstream endpoints, settable per-request or
account-wide. That is a legitimate posture, and its ZDR is a boolean where
Google's is an approval cycle.

Rejected for production on two narrower grounds. **It adds a hop** — the models
run on the same third-party hardware either way, so the router is strictly one
more party in the path for a bank screenshot, with nothing gained in exchange.
And **schema enforcement gets softer**: this design leans on Gemini enforcing
the JSON Schema server-side, but through a router that depends on which
endpoint serves the request, and ZDR routing constrains that pool. The
validate-and-retry-once path catches the fallback, so it is a quality
regression rather than a breakage — but it makes the extraction contract less
certain for no benefit.

Two caveats worth recording if this is ever revisited: OpenRouter treats
in-memory prompt caching at the provider as not "retention", which is a
definitional call made on our behalf; and a given cheap model may have no
ZDR-eligible endpoint at all, so rate-card price and the price available under
our privacy constraint are not the same number.

**Kept for evaluation.** See *OpenRouter answers the open-model question* above
— this is how the self-hosting question gets answered before the tunnel exists.

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
