export type DocEntry = {
	title: string;
	url: string;
	description: string;
};

export const LLMS_INDEXES: readonly string[] = [
	"https://docs.rocket.chat/llms.txt",
	"https://developer.rocket.chat/llms.txt",
];

const ENTRY = /^\s*-\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*(?::\s*(.*))?$/;

export const parseLlmsTxt = (text: string): DocEntry[] => {
	const entries: DocEntry[] = [];
	const seen = new Set<string>();

	for (const line of text.split("\n")) {
		const match = ENTRY.exec(line);
		if (!match) continue;

		const [, title, url, description] = match;
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

export const fetchDocIndex = async (
	indexes: readonly string[] = LLMS_INDEXES
): Promise<DocEntry[]> => {
	const all: DocEntry[] = [];
	const seen = new Set<string>();

	for (const index of indexes) {
		const entries = parseLlmsTxt(await fetchText(index));
		for (const entry of entries) {
			if (seen.has(entry.url)) continue;
			seen.add(entry.url);
			all.push(entry);
		}
	}

	return all.sort((a, b) => a.url.localeCompare(b.url));
};
