import { USER_AGENT } from "./docIndex";
import { markdownToDoc, type SourceDoc } from "./markdown";

const DEFAULT_CONCURRENCY = 4;
const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;
const DEFAULT_RATE_LIMIT_PAUSE_MS = 15_000;

export class FetchError extends Error {
	constructor(
		readonly status: number,
		readonly retryAfterMs: number | null,
		message: string
	) {
		super(message);
		this.name = "FetchError";
	}

	get retryable(): boolean {
		return this.status === 429 || this.status === 408 || this.status >= 500;
	}
}

export type FetchedDoc = SourceDoc & { error?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfter = (header: string | null): number | null => {
	if (!header) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(header);
	return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

/**
 * Shared cooldown. A 429 means the host is unhappy with all of us, not just the
 * one request, so every worker waits rather than the others carrying on and
 * deepening the block.
 */
let cooldownUntil = 0;

const respectCooldown = async () => {
	const wait = cooldownUntil - Date.now();
	if (wait > 0) await sleep(wait);
};

const startCooldown = (ms: number) => {
	cooldownUntil = Math.max(cooldownUntil, Date.now() + ms);
};

const backoff = (attempt: number) => {
	const exponential = Math.min(
		BASE_BACKOFF_MS * 2 ** (attempt - 1),
		MAX_BACKOFF_MS
	);
	// Jitter so parallel workers do not retry in lockstep.
	return exponential / 2 + Math.random() * (exponential / 2);
};

const fetchOnce = async (url: string): Promise<string> => {
	const response = await fetch(url, {
		headers: { "user-agent": USER_AGENT, accept: "text/plain, text/markdown" },
	});

	if (!response.ok) {
		throw new FetchError(
			response.status,
			parseRetryAfter(response.headers.get("retry-after")),
			`${response.status} ${response.statusText}`
		);
	}

	return response.text();
};

export const fetchDoc = async (markdownUrl: string): Promise<FetchedDoc> => {
	let last = "unknown error";

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		await respectCooldown();

		try {
			return markdownToDoc(markdownUrl, await fetchOnce(markdownUrl));
		} catch (e) {
			const error = e instanceof FetchError ? e : null;
			last = (e as Error).message;

			// A 404 will never become a 200; stop immediately.
			if (error && !error.retryable) break;

			if (error?.status === 429) {
				startCooldown(error.retryAfterMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS);
			}

			if (attempt < MAX_ATTEMPTS) await sleep(backoff(attempt));
		}
	}

	return { url: markdownUrl, title: "", text: "", error: last };
};

export type FetchDocsOptions = { concurrency?: number };

export async function* fetchDocs(
	urls: readonly string[],
	{ concurrency = DEFAULT_CONCURRENCY }: FetchDocsOptions = {}
): AsyncGenerator<FetchedDoc> {
	for (let i = 0; i < urls.length; i += concurrency) {
		const batch = urls.slice(i, i + concurrency);
		for (const doc of await Promise.all(batch.map(fetchDoc))) yield doc;
	}
}
