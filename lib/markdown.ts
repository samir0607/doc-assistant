export type SourceDoc = {
	url: string;
	title: string;
	text: string;
};

export type Frontmatter = Record<string, string>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const parseFrontmatter = (
	raw: string
): { frontmatter: Frontmatter; body: string } => {
	const match = FRONTMATTER.exec(raw);
	if (!match) return { frontmatter: {}, body: raw };

	const frontmatter: Frontmatter = {};
	for (const line of match[1].split("\n")) {
		const separator = line.indexOf(":");
		if (separator < 1) continue;
		const key = line.slice(0, separator).trim();
		const value = line
			.slice(separator + 1)
			.trim()
			.replace(/^["']|["']$/g, "");
		if (key) frontmatter[key] = value;
	}

	return { frontmatter, body: raw.slice(match[0].length) };
};

export const stripIndexNotice = (body: string): string => {
	const lines = body.split("\n");
	let end = 0;
	while (end < lines.length && lines[end].trim() === "") end += 1;

	let quoteEnd = end;
	while (quoteEnd < lines.length && lines[quoteEnd].trimStart().startsWith(">")) {
		quoteEnd += 1;
	}
	if (quoteEnd === end) return body;

	const quoted = lines.slice(end, quoteEnd).join("\n");
	if (!/documentation index|llms\.txt/i.test(quoted)) return body;

	return lines.slice(quoteEnd).join("\n").replace(/^\s*\n/, "");
};

export const firstHeading = (body: string): string => {
	const match = /^#\s+(.+?)\s*$/m.exec(body);
	return match ? match[1].trim() : "";
};

export const markdownToDoc = (url: string, raw: string): SourceDoc => {
	const { frontmatter, body } = parseFrontmatter(raw);
	const text = stripIndexNotice(body).trim();
	return {
		url,
		title: frontmatter.title?.trim() || firstHeading(text),
		text,
	};
};
