import { describe, expect, it } from "vitest";

import {
	chunkDocument,
	hashContent,
	sectionPath,
	splitSections,
} from "./chunking";

const doc = (text: string) => ({
	url: "https://docs.rocket.chat/docs/deploy",
	title: "Deploy Rocket.Chat",
	text,
});

describe("splitSections", () => {
	it("prefixes each section with the document title", () => {
		const sections = splitSections("Intro paragraph.", "Deploy");
		expect(sections).toEqual([{ path: "Deploy", body: "Intro paragraph." }]);
	});

	it("builds a heading path from the heading hierarchy", () => {
		const sections = splitSections(
			[
				"## Docker",
				"Use compose.",
				"### Prerequisites",
				"Install Docker.",
			].join("\n"),
			"Deploy"
		);

		expect(sections.map((s) => s.path)).toEqual([
			"Deploy > Docker",
			"Deploy > Docker > Prerequisites",
		]);
	});

	it("pops back up the hierarchy when a shallower heading appears", () => {
		const sections = splitSections(
			[
				"# A",
				"body a",
				"## A1",
				"body a1",
				"# B",
				"body b",
			].join("\n"),
			"T"
		);

		expect(sections.map((s) => s.path)).toEqual([
			"T > A",
			"T > A > A1",
			"T > B",
		]);
	});

	it("drops headings that have no body", () => {
		const sections = splitSections("# Empty\n\n# Real\nbody", "T");
		expect(sections).toEqual([{ path: "T > Real", body: "body" }]);
	});
});

describe("chunkDocument", () => {
	it("keeps chunks within the hard ceiling", () => {
		const paragraph = "Rocket.Chat deployment step. ".repeat(400);
		const chunks = chunkDocument(doc(`# Guide\n${paragraph}`), {
			targetChars: 400,
			maxChars: 500,
		});

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.body.length).toBeLessThanOrEqual(500);
		}
	});

	it("embeds the heading path alongside the body", () => {
		const [chunk] = chunkDocument(doc("## Docker\nRun compose up."));
		expect(chunk.text).toBe(`${chunk.section}\n\n${chunk.body}`);
		expect(chunk.section).toContain("Docker");
	});

	it("numbers chunks sequentially across sections", () => {
		const body = "word ".repeat(500);
		const chunks = chunkDocument(
			doc(`## One\n${body}\n\n## Two\n${body}`),
			{ targetChars: 300, maxChars: 400 }
		);

		expect(chunks.map((c) => c.chunkIndex)).toEqual(
			chunks.map((_, index) => index)
		);
	});

	it("is deterministic — same input, same hashes", () => {
		const input = doc("## Docker\nRun compose up.\n\n## AWS\nUse the AMI.");
		const a = chunkDocument(input);
		const b = chunkDocument(input);
		expect(a.map((c) => c.contentHash)).toEqual(b.map((c) => c.contentHash));
	});

	it("changes the hash when the body changes", () => {
		const [before] = chunkDocument(doc("## Docker\nRun compose up."));
		const [after] = chunkDocument(doc("## Docker\nRun compose down."));
		expect(before.contentHash).not.toBe(after.contentHash);
	});

	it("changes the hash when the same body moves to another page", () => {
		const [a] = chunkDocument(doc("## Docker\nRun compose up."));
		const [b] = chunkDocument({
			...doc("## Docker\nRun compose up."),
			url: "https://docs.rocket.chat/docs/other",
		});
		expect(a.contentHash).not.toBe(b.contentHash);
	});

	it("overlaps consecutive chunks so split procedures keep their lead-in", () => {
		const chunks = chunkDocument(
			doc(
				[
					"# Steps",
					"First paragraph that sets up the procedure.",
					"",
					"Second paragraph continuing the procedure.",
					"",
					"Third paragraph finishing the procedure.",
				].join("\n")
			),
			{ targetChars: 60, maxChars: 200, overlapChars: 20, minChars: 0 }
		);

		expect(chunks.length).toBeGreaterThan(1);
		const tail = chunks[0].body.slice(-20).trimStart();
		expect(chunks[1].body).toContain(tail);
	});

	it("normalises whitespace so re-scrapes produce stable hashes", () => {
		const [tight] = chunkDocument(doc("# H\nRun  compose   up."));
		const [loose] = chunkDocument(doc("# H\nRun compose up."));
		expect(tight.contentHash).toBe(loose.contentHash);
	});

	it("returns nothing for empty input", () => {
		expect(chunkDocument(doc(""))).toEqual([]);
		expect(chunkDocument(doc("   \n\n  "))).toEqual([]);
	});
});

describe("hashContent", () => {
	it("distinguishes different field groupings", () => {
		expect(hashContent("a", "bc")).not.toBe(hashContent("ab", "c"));
	});
});

describe("sectionPath", () => {
	it("joins the title and heading hierarchy", () => {
		expect(sectionPath("Deploy", ["Docker", "Prerequisites"])).toBe(
			"Deploy > Docker > Prerequisites"
		);
	});

	it("collapses a heading that repeats the page title", () => {
		expect(sectionPath("Add License", ["Add License"])).toBe("Add License");
		expect(sectionPath("Add License", ["Add License", "Changelog"])).toBe(
			"Add License > Changelog"
		);
	});

	it("compares case-insensitively when collapsing", () => {
		expect(sectionPath("Deploy Rocket.Chat", ["deploy rocket.chat"])).toBe(
			"Deploy Rocket.Chat"
		);
	});

	it("keeps a repeat that is not adjacent", () => {
		expect(sectionPath("API", ["Users", "API"])).toBe("API > Users > API");
	});

	it("skips empty and missing levels", () => {
		expect(sectionPath("", [undefined, "Docker"])).toBe("Docker");
		expect(sectionPath("Deploy", [])).toBe("Deploy");
	});
});

describe("sectionPath bounds", () => {
	it("truncates a single absurdly long heading", () => {
		const heading = "x".repeat(5000);
		expect(sectionPath("Title", [heading]).length).toBeLessThanOrEqual(400);
	});

	it("bounds the whole path however deep the hierarchy", () => {
		const deep = Array.from({ length: 40 }, (_, i) => `Level ${i} `.repeat(20));
		expect(sectionPath("Title", deep).length).toBeLessThanOrEqual(400);
	});

	it("keeps ordinary paths untouched", () => {
		expect(sectionPath("Deploy", ["Docker"])).toBe("Deploy > Docker");
	});
});

describe("chunkDocument bounds", () => {
	it("keeps embedded text small enough for the embeddings API", () => {
		// A line starting with '#' is read as a heading, and docs contain shell
		// comments and minified blobs. Without a cap, one such line became a
		// section path of tens of thousands of characters and the whole seed run
		// failed on 'maximum input length is 8192 tokens'.
		const monstrous = `# ${"a".repeat(60_000)}\n\nbody text here`;
		for (const chunk of chunkDocument(doc(monstrous))) {
			expect(chunk.text.length).toBeLessThan(2500);
		}
	});
});
