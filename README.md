# 🚀 Rocket.Chat AI Docs Assistant

A retrieval-augmented question answering app over the complete Rocket.Chat documentation — 1,278 pages, 8,875 embedded chunks — with grounded, cited, streaming answers.

| | |
| --- | --- |
| User documentation | 445 pages (`docs.rocket.chat/docs`) |
| Developer guides | 124 pages (`developer.rocket.chat/docs`) |
| REST API reference | 709 pages (`developer.rocket.chat/apidocs`) |
| Indexed chunks | 8,875 (7.0 per page average) |
| Stack | Next.js 15 App Router · Vercel AI SDK · OpenAI · AstraDB · TypeScript (strict) · Vitest |

---

## Quick start

```bash
git clone https://github.com/samir0607/doc-assistant
cd doc-assistant
npm install
```

Create a serverless **vector** database in [Astra](https://astra.datastax.com/) and an [OpenAI](https://platform.openai.com/) account with credits, then save `.env` in the project root:

```.env
ASTRA_DB_NAMESPACE=""
ASTRA_DB_COLLECTION="" 
ASTRA_DB_API_ENDPOINT=""
ASTRA_DB_APPLICATION_TOKEN=""
OPENAI_API_KEY=""
```

The collection is created on first seed with 1,536 dimensions and the `cosine` metric. No scraping key or browser is needed.

```bash
npm run discover   # refresh the page list from llms.txt
npm run seed       # build the index (incremental)
npm run dev        # http://localhost:3000
```

### Commands

| Command | Purpose |
| --- | --- |
| `npm run discover` | Rewrite [`lib/doc-urls.json`](lib/doc-urls.json) from each host's `llms.txt` |
| `npm run seed` | Index new and changed pages; prune pages no longer listed |
| `npm run seed -- --fresh` | Drop the collection and rebuild from scratch |
| `npm run verify` | Compare the index against the page list and explain any gaps |
| `npm test` | 106 unit tests over the pure half of the pipeline |
| `npm run dev` / `build` / `start` | Next.js |

---

# Fundamentals

This section is the interesting part: what the techniques are, and why each one is here.

## 1. Retrieval-augmented generation (RAG)

A language model cannot reliably answer questions about a specific product from memory — it will confabulate flags, endpoints and version numbers that sound right. RAG replaces recall with retrieval: find the relevant documentation first, then ask the model to answer **using only that text**.

The pipeline is two independent halves:

```
INGESTION  (offline, npm run seed)
  discover URLs → fetch markdown → chunk → embed → store vectors

RETRIEVAL  (per request, /api/chat)
  question → condense → embed → vector search → rank → prompt → stream
```

Everything below is a decision inside one of those halves.

## 2. Embeddings and vector search

An **embedding** turns text into a vector — here 1,536 floats via OpenAI's `text-embedding-3-small`. Texts about similar things land near each other, so "how do I run this in a container" can match a chunk that only ever says "Docker". That is semantic search, and it is why keyword matching is not enough for documentation.

Every chunk is embedded once at index time and stored in AstraDB alongside its text. At query time the question is embedded the same way, and the database returns nearest neighbours.

**Cosine vs dot product.** OpenAI embeddings are L2-normalised (unit length), so cosine similarity and dot product rank identically. The collection uses `cosine` anyway, because it states the intent — similarity of *direction*, not magnitude — and stays correct if the embedding model is ever swapped for one that is not normalised.

## 3. Chunking

Whole pages are the wrong retrieval unit. A 40 KB deployment guide embedded as one vector averages out into a vague "something about deployment", and it would swamp the model's context. So documents are split.

Naive fixed-size splitting cuts procedures mid-step. This project splits on **document structure** instead:

| Setting | Value | Why |
| --- | --- | --- |
| Split boundary | Markdown heading hierarchy | Sections are semantic units the author already chose |
| Target size | 1,200 chars | Big enough for a whole procedure, small enough to stay specific |
| Hard ceiling | 1,500 chars | Oversized paragraphs are split at sentence boundaries, then hard-sliced |
| Minimum | 250 chars | A runt tail is folded back into its predecessor |
| Overlap | 150 chars | The tail of one chunk prefixes the next, so a split procedure keeps its lead-in |

**Heading-path prefixing** is the technique that matters most. Each chunk is embedded as:

```
Deploy with Docker and Docker Compose > Prerequisites

Install Docker Engine 20.10 or later…
```

The body may never contain the word "deploy", but the path does, so the chunk still matches "how do I deploy". Context that a human reader gets from the page around them has to be written *into* the chunk, because the retriever sees nothing else.

Two guards keep this honest. Adjacent duplicate path segments collapse, because docs pages almost always open with an `h1` restating their own title — otherwise every chunk paid for "Deploy with Docker > Deploy with Docker". And headings are capped at 120 characters with the joined path at 400, because *any* line starting with `#` reads as a heading, and docs are full of shell comments inside code fences. One long such line once produced a section path tens of thousands of characters long and failed a whole run on the embedding API's 8,192-token input limit.

## 4. Content-addressed incremental indexing

Re-embedding 8,875 chunks on every run wastes money and time. Instead, each chunk's identity **is** its content:

```
_id = sha256(url + section + body)
```

A run compares the hashes a page produces now against the hashes already stored for that URL, then inserts what is new, deletes what is gone, and leaves the rest untouched. Consequences:

- Adding one page costs one page.
- A run over unchanged docs embeds **nothing** — measured: 8,870 of 8,875 chunks unchanged.
- Seeding is idempotent, so an interrupted run is safe to repeat.
- Pages dropped from the list are **pruned**, so the index converges on the list rather than only growing toward it. Without this, a renamed page keeps its chunks forever and keeps being cited at a dead URL.

This only works if extraction is **deterministic** — identical input must produce identical bytes. That single requirement drove the biggest design decision in the project.

## 5. Markdown as the source of truth

The obvious approach is scraping rendered HTML. That was tried, and it was wrong in four separate ways:

| Problem | Consequence |
| --- | --- |
| Both hosts are Document360 SPAs | A plain `fetch` returns an empty shell; a headless browser is required |
| Cloudflare answers headless Chrome with a bot check | "Just a moment…" was silently indexed *as documentation* |
| Sidebar and toolbar render asynchronously | Output varied run to run, so unchanged pages kept re-embedding |
| HTML→text loses code fences | 120 fenced blocks on one page became undifferentiated prose |

Both hosts publish every page as clean markdown at `<page>.md`, with YAML frontmatter. Reading that instead fixed all four at once and deleted an entire dependency:

- Real headings, so structural chunking works on real structure
- Fenced code blocks intact, which matters enormously for a docs assistant
- No navigation chrome polluting every chunk
- A static file, so byte-identical run to run
- A plain `fetch` — no Puppeteer, no ~300 MB install, no bot-check handling

**Lesson worth generalising:** before writing a scraper, check whether the site publishes a machine-readable version. Increasingly they do.

## 6. Discovery via `llms.txt`

`llms.txt` is an emerging convention: a plain-text index of a site's pages for machine consumption. Both hosts publish one, so discovery is two HTTP requests instead of a crawl.

This matters more than convenience. A 500-page breadth-first crawl of the rendered navigation found 565 URLs; `llms.txt` lists 1,279. The gap was the entire REST API reference, which lives under `/apidocs` rather than `/docs` and which the crawl's path filter excluded outright.

Neither host serves a usable `sitemap.xml` — being SPAs, `/sitemap.xml` returns the shell — which makes crawling look like the only option. It is not.

`llms.txt` is authoritative but **not** perfect, and both flaws are handled:

- It HTML-entity-encodes non-ASCII URLs, so a slug containing `ç` is listed as `nomea&#231;&#227;o` — a URL that 404s verbatim. Entities are decoded before use.
- It omits one real article. Found by cross-checking against the independent crawl: of the URLs only the crawl reached, every other one returns 404 for its `.md` because they are navigation *categories*, not articles, and their content is already covered by the children `llms.txt` does list.

Trusting a single source of truth without a second opinion would have left holes. The cross-check is documented in [`lib/docIndex.ts`](lib/docIndex.ts) so it can be repeated.

## 7. Surviving the network

Ingesting 1,278 pages means the failure modes stop being hypothetical.

**Rate limiting.** The host returns `429`. The original three retries at 500 ms could not ride one out, and — worse — a throttled page came back empty and was reported as "empty or unreachable", indistinguishable from a page that does not exist. One run lost 524 pages while reporting success. That is the worst failure mode an index can have. Now:

- `Retry-After` is honoured when present
- Exponential backoff with **jitter**, so parallel workers do not retry in lockstep
- Six attempts, and a cooldown **shared by every worker** — a 429 means the host is unhappy with all of us, so everyone waits rather than the rest deepening the block
- `404` fails immediately; it will never become a `200`
- The failure reason is carried on the result, so the caller can tell "missing" from "throttled"

**Throughput.** Embedding once per page meant ~1,278 serial round-trips, measured at over two hours. Chunks now accumulate across pages and flush in batches of 96 to the embeddings API and 20 to Astra — roughly a fifteenth of the requests. Fetching runs 4 concurrently, which the host tolerates without complaint.

**Isolation.** A failed page returns empty rather than throwing, so one bad URL cannot abort a 1,278-page run.

## 8. Ranked retrieval

Raw vector search returns nearest neighbours, which is not the same as good context. A single unranked top-10 dump has three problems: weak matches dilute the prompt, duplicate text wastes the window, and one long page can occupy every slot.

So retrieval over-fetches and then filters:

```
30 candidates  →  drop similarity < 0.3  →  dedupe bodies  →  cap 3 per page  →  top 8
```

| Stage | Purpose |
| --- | --- |
| Over-fetch 30 | Leaves room to discard without ending up short |
| Similarity floor | Below ~0.3 a chunk is noise; better to have less context than wrong context |
| Body dedupe | The same passage often appears on several pages |
| Per-page cap of 3 | Stops a 52-chunk guide crowding out every other source |
| Top 8 | Fits the context budget with room for the conversation |

The ranking function is **pure** — candidates in, ranked list out — so all of that behaviour is unit tested without a database.

## 9. Query condensation for multi-turn retrieval

Retrieval embeds the user's question, which breaks the moment a conversation has history:

> **User:** How do I deploy with Docker Compose?
> **Assistant:** …
> **User:** how about on AWS?

"how about on AWS?" carries almost no retrievable signal. Embedding it alone returns near-random chunks — the single most common bug in naive RAG chat.

So before searching, a cheap model call rewrites the follow-up into a standalone question using the last six turns. Verified: the rewritten form retrieves `deploy-with-aws` pages where the raw form could not. If the rewrite fails, the raw question is used rather than failing the request, and a first question skips the call entirely.

## 10. Grounded prompting and citations

Retrieval is pointless if the model ignores it. The system prompt:

- Restricts the answer to the numbered context, and says to admit when it is not there
- Requires inline citations `[1]`, `[2]` naming only numbers that appear in the context
- Asks for markdown, fenced code with language tags, and ordered steps for procedures
- **Instructs a refusal when retrieval found nothing** — a zero-hit search must not silently become a from-memory answer

**Citations number per page, not per chunk.** Several chunks routinely come from the same page, and the UI groups its source chips by page. Numbering per chunk let the model cite `[2]` when the UI only rendered a chip for `[1]` — a citation pointing at nothing. One number per URL keeps the prompt and the interface in agreement, and a test asserts no context block can carry a number the client will not show.

## 11. Streaming

Answers stream token by token, so the first words appear in about a second instead of the reader waiting for the whole response.

The Vercel AI SDK's data stream protocol carries more than text. Sources are written as a **message annotation** before the text begins, so citations can render as they are referenced rather than appearing after the stream closes:

```
8:[{"sources":[{"index":1,"url":"…","title":"Deploy Rocket.Chat"}]}]
0:"To deploy "
0:"Rocket.Chat"
…
```

Annotations are untyped JSON on the wire, so the client **validates** rather than casts them.

## 12. Architecture: keeping I/O at the edges

The route handler originally owned HTTP parsing, embedding, vector search and prompt assembly — none of which could be tested without starting Next.js. Everything now lives in `lib/`, and the route does HTTP only.

The organising principle: **pure logic in the middle, I/O at the edges.** Chunking, ranking, citation numbering, `llms.txt` parsing, frontmatter handling and the rate-limit window are all pure functions, which is why 106 tests run in under a second with no database, no network and no browser.

Two consequences worth naming:

- **Lazy client construction.** The OpenAI and Astra clients are built on first use, not at module load. Building them at import time made `next build` fail without secrets — a build should never need production credentials.
- **The module graph is acyclic.** `retrieval` needed the condense prompt and `prompts` needed the source types, so the two imported each other. It worked, but a cycle between core modules is fragile, so the query-building step was lifted above both: `query → prompts → retrieval`.

## 13. Operational correctness

**Rate limiting.** `/api/chat` spends an embedding plus a completion on every call, against your key, with no authentication. A sliding-window limiter caps it at 20 requests per minute per IP, checked *before* the body is parsed so a rejected request costs nothing. The clock and store are injectable, so the window is tested without waiting.

The window lives in the process, so each serverless instance keeps its own budget and a cold start resets it. That covers the immediate exposure without adding Redis; the call signature is deliberately close to `@upstash/ratelimit` for when a cross-instance ceiling is wanted.

**Coverage as an assertion, not an inference.** `seed` exits non-zero if any page could not be fetched, so silence means completeness. `verify` closes the loop from the index side: it reads back every stored chunk, compares URLs against the list, and **re-fetches absent pages to explain why** — separating "empty upstream, correctly skipped" from "should be here and is not". Eight listed pages hold nothing but frontmatter and a lone heading, so a check that failed on them would have been permanently red, and a permanently red check is one you stop reading.

**Secrets are compared in constant time.** `CRON_SECRET` uses `timingSafeEqual`, not `===`.

**Errors do not leak.** Failures log server-side and return a generic message; the original code rethrew and exposed stack traces to the browser.

---

## Frontend

Streaming chat has its own set of details that separate a demo from something usable.

**Scroll pinning.** Auto-scrolling on every token fights the reader — scroll up to re-read something mid-stream and you get yanked back. The view follows only while you are parked within 80 px of the bottom, and offers "Jump to latest" otherwise.

**Composer.** A textarea that grows with its content to 200 px; Enter sends, Shift+Enter inserts a newline; `compositionstart`/`compositionend` are respected so IME input is not cut off mid-word; send is disabled until there is text; streaming can be stopped.

**Theming.** The whole stylesheet runs on design tokens, with light and dark palettes taken from [Noctis](https://github.com/liviuschera/noctis) — Noctis Lux and Noctis, switched on `prefers-color-scheme`. Each token names the editor key its value came from. Two values deviate deliberately: Noctis Lux's comment colour is about 2.4:1 on the cream ground, too low for secondary text, and its `textPreformat` orange is about 1.9:1 for inline code.

**Accessibility.** The transcript is an `aria-live` log; the typing indicator is a `status` region with screen-reader text; focus is `:focus-visible` throughout; `prefers-reduced-motion` disables animation; wide content scrolls inside its own container so the page body never scrolls sideways.

**Markdown rendering.** `react-markdown` with `remark-gfm` for tables and strikethrough, code blocks with copy buttons that read `textContent` off the DOM rather than reassembling React children, and links opening in new tabs.

---

## Keeping the database awake

An Astra serverless database hibernates after a stretch of inactivity, and the first request afterwards pays the wake-up cost. `GET /api/health` performs a real read against the collection:

```json
{ "status": "ok", "database": "reachable", "populated": true, "latencyMs": 271 }
```

503 when Astra cannot be reached. It is `force-dynamic` with `cache-control: no-store`, because a cached 200 would never touch the database and would keep reporting health while the database slept. It is a real `findOne`, not just client construction, which succeeds without any network call and would prove nothing.

[`vercel.json`](vercel.json) runs it once a day at 06:00 UTC — the most the Hobby plan allows, and comfortably inside Astra's inactivity window, which is measured in days. Minute-level schedules need a Pro plan.

Set `CRON_SECRET` to close the endpoint; Vercel Cron sends it as `Authorization: Bearer $CRON_SECRET` automatically. Left unset it stays open but rate limited to 12 requests per minute per IP, on a budget **namespaced away from** `/api/chat` so keep-alive pings cannot exhaust the chat allowance for the same IP.

---

## Tuning

| What | Where |
| --- | --- |
| Chunk size, overlap, path caps | `DEFAULTS` in [`lib/chunking.ts`](lib/chunking.ts) |
| Candidates, context size, similarity floor, per-page cap | constants in [`lib/retrieval.ts`](lib/retrieval.ts) |
| System prompt, citation rules, condense prompt | [`lib/prompts.ts`](lib/prompts.ts) |
| Models | `EMBEDDING_MODEL` in `lib/retrieval.ts`, `CHAT_MODEL` in the chat route, `CONDENSE_MODEL` in `lib/query.ts` |
| Which hosts are indexed | `LLMS_INDEXES` in [`lib/docIndex.ts`](lib/docIndex.ts), then `npm run discover` |
| Pages to keep out | `EXCLUDE` in [`lib/sources.ts`](lib/sources.ts) — how tag listing pages are dropped |
| Rate limits | constants in the two route handlers |
| Fetch concurrency, retries, backoff | constants in [`lib/docFetch.ts`](lib/docFetch.ts) |

Changing anything that affects chunk text changes every content hash, so the next seed re-embeds the corpus. Changing retrieval or prompt settings costs nothing — no re-indexing needed.

---

## Project layout

| Path | Responsibility |
| --- | --- |
| [`lib/docIndex.ts`](lib/docIndex.ts) | `llms.txt` parsing, entity decoding, page discovery |
| [`lib/docFetch.ts`](lib/docFetch.ts) | Concurrent markdown fetching, backoff, shared cooldown |
| [`lib/markdown.ts`](lib/markdown.ts) | Frontmatter, boilerplate stripping, title fallback |
| [`lib/chunking.ts`](lib/chunking.ts) | Section splitting, packing, content hashing |
| [`lib/sources.ts`](lib/sources.ts) | The indexed page list plus exclusions |
| [`lib/retrieval.ts`](lib/retrieval.ts) | Embedding, vector search, ranking, citation numbering |
| [`lib/query.ts`](lib/query.ts) | Turning a conversation into a search query |
| [`lib/prompts.ts`](lib/prompts.ts) | System prompt, context rendering, condense prompt |
| [`lib/rateLimit.ts`](lib/rateLimit.ts) | Sliding-window limiter with injectable clock |
| [`lib/cronAuth.ts`](lib/cronAuth.ts) | Constant-time bearer-secret check |
| [`scripts/discoverUrls.ts`](scripts/discoverUrls.ts) | Discovery CLI |
| [`scripts/loadDB.ts`](scripts/loadDB.ts) | Seed CLI: fetch, chunk, embed, prune |
| [`scripts/verifyIndex.ts`](scripts/verifyIndex.ts) | Coverage check |
| [`app/api/chat/route.ts`](app/api/chat/route.ts) | HTTP and streaming only |
| [`app/api/health/route.ts`](app/api/health/route.ts) | Astra reachability and keep-alive |
| [`app/page.tsx`](app/page.tsx) | Chat shell, scroll behaviour, error handling |
| [`app/components/`](app/components/) | Composer, message bubbles, citations, code blocks |
| [`app/global.css`](app/global.css) | Design tokens and the Noctis palettes |

---

## Known limits

- **Retrieval has no reranker.** Ranking is similarity plus diversity heuristics. A cross-encoder reranker over the 30 candidates would improve precision at the cost of a model call per query.
- **The rate limiter is per-instance.** Fine for cost control, not a hard ceiling across serverless instances.
- **Chunks carry no freshness signal.** Frontmatter has an `updated` timestamp that is not currently surfaced, so answers cannot say how old a page is.
- **One non-English page** is indexed (a Portuguese data-protection notice), which mixes languages in the vector space to a negligible degree.
- **Eight listed pages are empty upstream** and therefore absent from the index. `npm run verify` reports them as expected rather than as failures, and will flag them if they ever gain content.
