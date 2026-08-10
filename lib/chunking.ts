import { createHash } from "node:crypto";

export type Chunk = {
	url: string;
	title: string;
	section: string;
	chunkIndex: number;
	body: string;
	text: string;
	contentHash: string;
};

export type ChunkOptions = {
	targetChars?: number;
	maxChars?: number;
	minChars?: number;
	overlapChars?: number;
};

const DEFAULTS = {
	targetChars: 1200,
	maxChars: 1500,
	minChars: 250,
	overlapChars: 150,
} satisfies Required<ChunkOptions>;

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const SECTION_SEPARATOR = " > ";

export const hashContent = (...parts: string[]): string =>
	createHash("sha256").update(parts.join("\n \n")).digest("hex");

const normalize = (text: string) => text.replace(/[ \t]+/g, " ").trim();

type Section = { path: string; body: string };

export const sectionPath = (
	title: string,
	headings: readonly (string | undefined)[]
): string => {
	const segments: string[] = [];
	for (const segment of [title, ...headings]) {
		const value = segment?.trim();
		if (!value) continue;
		const previous = segments[segments.length - 1];
		if (previous && previous.toLowerCase() === value.toLowerCase()) continue;
		segments.push(value);
	}
	return segments.join(SECTION_SEPARATOR);
};

export const splitSections = (text: string, title: string): Section[] => {
	const sections: Section[] = [];
	const stack: string[] = [];
	let body: string[] = [];

	const flush = () => {
		const joined = body.join("\n").trim();
		body = [];
		if (!joined) return;
		sections.push({ path: sectionPath(title, stack), body: joined });
	};

	for (const line of text.split("\n")) {
		const heading = HEADING.exec(line);
		if (!heading) {
			body.push(line);
			continue;
		}
		flush();
		const depth = heading[1].length;
		stack.length = Math.min(stack.length, depth - 1);
		stack[depth - 1] = heading[2];
	}
	flush();

	return sections;
};

const splitLongParagraph = (paragraph: string, maxChars: number): string[] => {
	const sentences = paragraph.split(/(?<=[.!?:])\s+/);
	const pieces: string[] = [];
	let current = "";

	const hardSplit = (text: string) => {
		for (let i = 0; i < text.length; i += maxChars) {
			pieces.push(text.slice(i, i + maxChars));
		}
	};

	for (const sentence of sentences) {
		if (sentence.length > maxChars) {
			if (current) {
				pieces.push(current);
				current = "";
			}
			hardSplit(sentence);
			continue;
		}
		if (current && current.length + sentence.length + 1 > maxChars) {
			pieces.push(current);
			current = sentence;
		} else {
			current = current ? `${current} ${sentence}` : sentence;
		}
	}

	if (current) pieces.push(current);
	return pieces;
};

const packSection = (body: string, opts: Required<ChunkOptions>): string[] => {
	const paragraphs = body
		.split(/\n{2,}/)
		.map(normalize)
		.filter(Boolean)
		.flatMap((p) =>
			p.length > opts.maxChars ? splitLongParagraph(p, opts.maxChars) : [p]
		);

	const bodies: string[] = [];
	let current = "";

	for (const paragraph of paragraphs) {
		if (!current) {
			current = paragraph;
		} else if (current.length + paragraph.length + 2 <= opts.targetChars) {
			current = `${current}\n\n${paragraph}`;
		} else {
			bodies.push(current);
			const room = opts.maxChars - paragraph.length - 2;
			const carry = Math.min(opts.overlapChars, room);
			const overlap = carry > 0 ? current.slice(-carry).trimStart() : "";
			current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
		}
	}
	if (current) bodies.push(current);

	if (bodies.length > 1) {
		const last = bodies[bodies.length - 1];
		const previous = bodies[bodies.length - 2];
		if (
			last.length < opts.minChars &&
			previous.length + last.length + 2 <= opts.maxChars
		) {
			bodies.splice(-2, 2, `${previous}\n\n${last}`);
		}
	}

	return bodies;
};

export const chunkDocument = (
	doc: { url: string; title: string; text: string },
	options: ChunkOptions = {}
): Chunk[] => {
	const opts = { ...DEFAULTS, ...options };
	const chunks: Chunk[] = [];
	let chunkIndex = 0;

	for (const section of splitSections(doc.text, doc.title)) {
		for (const body of packSection(section.body, opts)) {
			chunks.push({
				url: doc.url,
				title: doc.title,
				section: section.path,
				chunkIndex: chunkIndex++,
				body,
				text: `${section.path}\n\n${body}`,
				contentHash: hashContent(doc.url, section.path, body),
			});
		}
	}

	return chunks;
};
