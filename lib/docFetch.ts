import { fetchText } from "./docIndex";
import { markdownToDoc, type SourceDoc } from "./markdown";

const DEFAULT_CONCURRENCY = 6;
const RETRIES = 3;
const RETRY_BASE_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchDoc = async (markdownUrl: string): Promise<SourceDoc> => {
	let lastError: unknown;

	for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
		try {
			return markdownToDoc(markdownUrl, await fetchText(markdownUrl));
		} catch (e) {
			lastError = e;
			if (attempt < RETRIES) await sleep(RETRY_BASE_MS * attempt);
		}
	}

	console.warn(`  ! ${markdownUrl}: ${(lastError as Error).message}`);
	return { url: markdownUrl, title: "", text: "" };
};

export type FetchDocsOptions = { concurrency?: number };

export async function* fetchDocs(
	urls: readonly string[],
	{ concurrency = DEFAULT_CONCURRENCY }: FetchDocsOptions = {}
): AsyncGenerator<SourceDoc> {
	for (let i = 0; i < urls.length; i += concurrency) {
		const batch = urls.slice(i, i + concurrency);
		for (const doc of await Promise.all(batch.map(fetchDoc))) yield doc;
	}
}
