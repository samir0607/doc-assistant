## 🚀 Rocket.Chat AI Docs Assistant

Scrapes the Rocket.Chat documentation, indexes it as embeddings in AstraDB, and answers questions from it with cited, streaming responses.

## ✨ Features

📄 **Web scraping** → Renders each docs page with Puppeteer and detects bot-check interstitials so a blocked page is never indexed as content.

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

> The collection is created for you on first seed, with 1536 dimensions and the `cosine` metric. No scraping API key is needed — pages are rendered locally with Puppeteer.

### Build the index

```bash
npm run seed              # incremental: only new or changed chunks are embedded
npm run seed -- --fresh   # drop the collection and rebuild from scratch
```

Pages to index live in [`lib/sources.ts`](lib/sources.ts) — add a URL and re-run `npm run seed`; unchanged pages are skipped.

### Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test
```

Covers the pure half of the pipeline: HTML extraction, challenge-page detection, chunking and hash stability, retrieval ranking, citation numbering, and the rate limiter.

## Project layout

| Path | Responsibility |
| --- | --- |
| [`lib/scrape.ts`](lib/scrape.ts) | HTML → heading-annotated text; Puppeteer fetching |
| [`lib/chunking.ts`](lib/chunking.ts) | Section splitting, packing, content hashing |
| [`lib/retrieval.ts`](lib/retrieval.ts) | Embedding, vector search, ranking, source numbering |
| [`lib/prompts.ts`](lib/prompts.ts) | System prompt, context rendering, query condensation |
| [`lib/rateLimit.ts`](lib/rateLimit.ts) | Per-IP sliding window |
| [`scripts/loadDB.ts`](scripts/loadDB.ts) | Seed CLI |
| [`app/api/chat/route.ts`](app/api/chat/route.ts) | HTTP handling and streaming only |
