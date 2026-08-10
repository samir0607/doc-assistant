export type DocEntry = {
	title: string;
	url: string;
	description: string;
};

export const LLMS_INDEXES: readonly string[] = [
	"https://docs.rocket.chat/llms.txt",
	"https://developer.rocket.chat/llms.txt",
];

/**
 * Articles that are published but absent from llms.txt.
 *
 * Found by cross-checking the index against an independent crawl of both hosts.
 * Of the URLs only the crawl reached, every other one returns 404 for its .md,
 * because they are navigation categories rather than articles and their content
 * lives in the children llms.txt does list. Re-run that comparison if coverage
 * is ever in question — llms.txt is authoritative for very nearly everything,
 * but not quite all of it.
 */
export const EXTRA_MARKDOWN_URLS: readonly string[] = [
	"https://developer.rocket.chat/docs/deprecated-parameters.md",
];

const ENTRY = /^\s*-\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*(?::\s*(.*))?$/;

/**
 * llms.txt writes non-ASCII characters in URLs as HTML entities, so a page whose
 * slug contains "ç" is listed as "nomea&#231;&#227;o" — a URL that 404s if used
 * verbatim. Decoding restores the real path, which fetch then encodes itself.
 */
export const decodeUrlEntities = (url: string): string =>
	url
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16))
		)
		.replace(/&#(\d+);/g, (_, dec) =>
			String.fromCodePoint(Number.parseInt(dec, 10))
		)
		.replace(/&amp;/g, "&");

export const parseLlmsTxt = (text: string): DocEntry[] => {
	const entries: DocEntry[] = [];
	const seen = new Set<string>();

	for (const line of text.split("\n")) {
		const match = ENTRY.exec(line);
		if (!match) continue;

		const [, title, rawUrl, description] = match;
		const url = decodeUrlEntities(rawUrl);
		if (seen.has(url)) continue;
		seen.add(url);

		entries.push({
			title: title.trim(),
			url,
			description: (description ?? "").trim(),
		});
	}

	return entries;
};

export const pageUrl = (markdownUrl: string): string =>
	markdownUrl.replace(/\.md$/, "");

export const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const fetchText = async (url: string): Promise<string> => {
	const response = await fetch(url, {
		headers: { "user-agent": USER_AGENT, accept: "text/plain, text/markdown" },
	});
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return response.text();
};

export const titleFromSlug = (markdownUrl: string): string => {
	const slug = decodeURIComponent(markdownUrl)
		.replace(/\.md$/, "")
		.split("/")
		.pop();
	if (!slug) return "";
	return slug.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
};

export const fetchDocIndex = async (
	indexes: readonly string[] = LLMS_INDEXES,
	extras: readonly string[] = EXTRA_MARKDOWN_URLS
): Promise<DocEntry[]> => {
	const all: DocEntry[] = [];
	const seen = new Set<string>();

	const add = (entry: DocEntry) => {
		if (seen.has(entry.url)) return;
		seen.add(entry.url);
		all.push(entry);
	};

	for (const index of indexes) {
		for (const entry of parseLlmsTxt(await fetchText(index))) add(entry);
	}

	for (const url of extras) {
		add({ title: titleFromSlug(url), url, description: "" });
	}

	return all.sort((a, b) => a.url.localeCompare(b.url));
};
