import { describe, expect, it } from "vitest";

import { rankChunks, toSources, type RetrievedChunk } from "./retrieval";

const chunk = (
	overrides: Partial<RetrievedChunk> & { similarity: number }
): RetrievedChunk => ({
	url: "https://docs.rocket.chat/docs/a",
	title: "A",
	section: "A > One",
	body: `body ${overrides.similarity}`,
	...overrides,
});

describe("rankChunks", () => {
	it("orders by similarity, highest first", () => {
		const ranked = rankChunks([
			chunk({ similarity: 0.4 }),
			chunk({ similarity: 0.9 }),
			chunk({ similarity: 0.6 }),
		]);

		expect(ranked.map((c) => c.similarity)).toEqual([0.9, 0.6, 0.4]);
	});

	it("drops chunks below the similarity floor", () => {
		const ranked = rankChunks(
			[chunk({ similarity: 0.5 }), chunk({ similarity: 0.1 })],
			{ minSimilarity: 0.3 }
		);

		expect(ranked).toHaveLength(1);
		expect(ranked[0].similarity).toBe(0.5);
	});

	it("removes duplicate bodies, keeping the strongest match", () => {
		const ranked = rankChunks([
			chunk({ similarity: 0.5, body: "same text" }),
			chunk({ similarity: 0.8, body: "same text" }),
		]);

		expect(ranked).toHaveLength(1);
		expect(ranked[0].similarity).toBe(0.8);
	});

	it("treats bodies differing only in surrounding whitespace as duplicates", () => {
		const ranked = rankChunks([
			chunk({ similarity: 0.9, body: "text" }),
			chunk({ similarity: 0.8, body: "  text  " }),
		]);

		expect(ranked).toHaveLength(1);
	});

	it("caps how many chunks one page can contribute", () => {
		const ranked = rankChunks(
			[
				chunk({ similarity: 0.9, body: "a1" }),
				chunk({ similarity: 0.8, body: "a2" }),
				chunk({ similarity: 0.7, body: "a3" }),
				chunk({ similarity: 0.6, body: "b1", url: "https://other" }),
			],
			{ maxPerUrl: 2 }
		);

		expect(ranked.map((c) => c.body)).toEqual(["a1", "a2", "b1"]);
	});

	it("lets a lower-ranked page through once a dominant page is capped", () => {
		const ranked = rankChunks(
			[
				chunk({ similarity: 0.99, body: "a1" }),
				chunk({ similarity: 0.98, body: "a2" }),
				chunk({ similarity: 0.3, body: "b1", url: "https://other" }),
			],
			{ maxPerUrl: 1, minSimilarity: 0.2 }
		);

		expect(ranked.map((c) => c.url)).toEqual([
			"https://docs.rocket.chat/docs/a",
			"https://other",
		]);
	});

	it("honours the result limit", () => {
		const ranked = rankChunks(
			Array.from({ length: 20 }, (_, i) =>
				chunk({ similarity: 1 - i / 100, body: `b${i}`, url: `https://u${i}` })
			),
			{ limit: 5 }
		);

		expect(ranked).toHaveLength(5);
	});

	it("skips chunks with an empty body", () => {
		const ranked = rankChunks([
			chunk({ similarity: 0.9, body: "   " }),
			chunk({ similarity: 0.8, body: "real" }),
		]);

		expect(ranked.map((c) => c.body)).toEqual(["real"]);
	});

	it("does not mutate its input", () => {
		const input = [chunk({ similarity: 0.2 }), chunk({ similarity: 0.9 })];
		const snapshot = input.map((c) => c.similarity);
		rankChunks(input);
		expect(input.map((c) => c.similarity)).toEqual(snapshot);
	});

	it("returns nothing when every candidate is noise", () => {
		expect(
			rankChunks([chunk({ similarity: 0.01 })], { minSimilarity: 0.3 })
		).toEqual([]);
	});
});

describe("toSources", () => {
	it("numbers sources from one, matching the prompt's context labels", () => {
		const sources = toSources([
			chunk({ similarity: 0.9, url: "https://a", title: "A" }),
			chunk({ similarity: 0.8, url: "https://b", title: "B" }),
		]);

		expect(sources).toEqual([
			{ index: 1, url: "https://a", title: "A" },
			{ index: 2, url: "https://b", title: "B" },
		]);
	});

	it("gives one number per page, not per chunk", () => {
		const sources = toSources([
			chunk({ similarity: 0.9, url: "https://a", body: "a1" }),
			chunk({ similarity: 0.8, url: "https://a", body: "a2" }),
			chunk({ similarity: 0.7, url: "https://b", body: "b1" }),
		]);

		expect(sources.map((s) => [s.index, s.url])).toEqual([
			[1, "https://a"],
			[2, "https://b"],
		]);
	});

	it("produces gapless numbering so every citation has a chip", () => {
		const sources = toSources([
			chunk({ similarity: 0.9, url: "https://a", body: "a1" }),
			chunk({ similarity: 0.8, url: "https://a", body: "a2" }),
			chunk({ similarity: 0.7, url: "https://a", body: "a3" }),
			chunk({ similarity: 0.6, url: "https://b", body: "b1" }),
			chunk({ similarity: 0.5, url: "https://c", body: "c1" }),
		]);

		expect(sources.map((s) => s.index)).toEqual([1, 2, 3]);
	});

	it("returns nothing for an empty context", () => {
		expect(toSources([])).toEqual([]);
	});

	it("falls back to the section, then the url, when there is no title", () => {
		expect(
			toSources([chunk({ similarity: 0.9, title: "", section: "S" })])[0].title
		).toBe("S");

		expect(
			toSources([
				chunk({ similarity: 0.9, title: "", section: "", url: "https://u" }),
			])[0].title
		).toBe("https://u");
	});
});
