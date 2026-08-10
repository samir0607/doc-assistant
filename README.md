## 🚀 Rocket.Chat AI Docs Assistant

Indexes the full Rocket.Chat documentation as embeddings in AstraDB and answers questions from it with cited, streaming responses. 1,277 pages: the user docs, the developer guides, and the complete REST API reference.

## ✨ Features

📄 **Markdown source of truth** → Both docs hosts publish every page as clean markdown at `<page>.md` and list them all in `llms.txt`. The pipeline reads those instead of scraping rendered HTML, so ingestion is a plain `fetch`: no browser, no bot-check interstitials, no navigation chrome mixed into the content, and byte-identical output run to run.

🔀 **Heading-aware chunking** → Splits on the document's heading hierarchy at ~1200 characters, and carries the heading path into each chunk so "how do I deploy" matches a section whose body never says "deploy".

🧠 **AI embeddings** → `text-embedding-3-small`, batched ~96 chunks per request.

📦 **Incremental indexing** → Each chunk's content hash is its primary key, so re-seeding only embeds pages that actually changed.

🔎 **Ranked retrieval** → Fetches 30 neighbours, drops weak matches, dedupes, and caps how many chunks any one page can contribute before passing the top 8 to the model.

💬 **Grounded answers with citations** → GPT-4o-mini answers from context only, cites inline as `[1]`, and the UI renders a matching source chip per page.

🔁 **Follow-up aware** → "how about on AWS?" is condensed into a standalone question before searching, so multi-turn retrieval works.

🛡 **Rate limited** → Per-IP sliding window on `/api/chat`.

⚡ **Streaming responses** → Vercel AI SDK, with a stop button and copy-to-clipboard.

## Getting started

### Clone the repository

```bash
git clone https://github.com/samir0607/doc-assistant
cd doc-assistant
npm install
```

### Set up the database and `.env`

Create a serverless **vector** database in [Astra](https://astra.datastax.com/), and an [OpenAI](https://platform.openai.com/) account with credits. Save the keys as `.env` in the project root:

```.env
ASTRA_DB_NAMESPACE=""
ASTRA_DB_COLLECTION=""
ASTRA_DB_API_ENDPOINT=""
ASTRA_DB_APPLICATION_TOKEN=""
OPENAI_API_KEY=""
```

> The collection is created for you on first seed, with 1536 dimensions and the `cosine` metric. No scraping key or browser is needed.

### Build the index

```bash
npm run discover          # refresh the page list from llms.txt
npm run seed              # incremental: only new or changed chunks are embedded
npm run seed -- --fresh   # drop the collection and rebuild from scratch
npm run verify            # check the index against the page list
```

`discover` reads `llms.txt` from each host — an index every page is listed in — and writes the result to [`lib/doc-urls.json`](lib/doc-urls.json). Two HTTP requests, authoritative, no crawling. Review the diff, then seed.

`seed` is incremental by content hash: adding pages costs only those pages, and a run over unchanged docs embeds nothing. It exits non-zero if any page could not be fetched, so a silent run means every listed page was indexed.

`verify` closes the loop from the other side: it reads back every stored chunk and compares the URLs it finds against `lib/doc-urls.json`, reporting listed pages that are missing and indexed pages that are no longer listed.

To change what gets indexed, add a host to `LLMS_INDEXES` in [`lib/docIndex.ts`](lib/docIndex.ts) and re-run `discover`. To drop pages from an otherwise good index, add a pattern to `EXCLUDE` in [`lib/sources.ts`](lib/sources.ts) — that is how tag listing pages are kept out.

### Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Keeping the database awake

An Astra serverless database hibernates after a stretch of inactivity, and the
first request afterwards pays the wake-up cost. `GET /api/health` performs a real
read against the collection and reports it:

```json
{ "status": "ok", "database": "reachable", "populated": true, "latencyMs": 271 }
```

It returns 503 if Astra cannot be reached, sets `cache-control: no-store`, and is
declared `force-dynamic` — a cached 200 would never touch the database and defeat
the point.

[`vercel.json`](vercel.json) runs it once a day at 06:00 UTC — the most the
Hobby plan allows, and comfortably inside Astra's inactivity window, which is
measured in days rather than minutes. Hobby fires the job at some point within
the given hour rather than exactly on the hour, which makes no difference to a
keep-alive. Minute-level schedules need a Pro plan.

Set `CRON_SECRET` in the environment to close the endpoint — Vercel Cron sends it
as `Authorization: Bearer $CRON_SECRET` automatically, and requests without it
then get a 401. Left unset, the endpoint is open but rate limited to 12 requests
per minute per IP, on a budget separate from `/api/chat`.

### Tests

```bash
npm test
```

Covers the pure half of the pipeline: `llms.txt` parsing, frontmatter handling, chunking and hash stability, retrieval ranking, citation numbering, and the rate-limit window.

## Project layout

| Path | Responsibility |
| --- | --- |
| [`lib/docIndex.ts`](lib/docIndex.ts) | `llms.txt` parsing and page discovery |
| [`lib/markdown.ts`](lib/markdown.ts) | Frontmatter parsing, boilerplate stripping |
| [`lib/docFetch.ts`](lib/docFetch.ts) | Concurrent markdown fetching with retries |
| [`lib/chunking.ts`](lib/chunking.ts) | Section splitting, packing, content hashing |
| [`lib/retrieval.ts`](lib/retrieval.ts) | Embedding, vector search, ranking, source numbering |
| [`lib/prompts.ts`](lib/prompts.ts) | System prompt, context rendering, query condensation |
| [`lib/rateLimit.ts`](lib/rateLimit.ts) | Per-IP sliding window |
| [`lib/cronAuth.ts`](lib/cronAuth.ts) | Bearer-secret check for scheduled calls |
| [`scripts/discoverUrls.ts`](scripts/discoverUrls.ts) | Discovery CLI |
| [`scripts/loadDB.ts`](scripts/loadDB.ts) | Seed CLI |
| [`scripts/verifyIndex.ts`](scripts/verifyIndex.ts) | Coverage check |
| [`app/api/chat/route.ts`](app/api/chat/route.ts) | HTTP handling and streaming only |
| [`app/api/health/route.ts`](app/api/health/route.ts) | Astra reachability and keep-alive |
