import { describe, expect, it } from "vitest";

import { decodeUrlEntities, pageUrl, parseLlmsTxt } from "./docIndex";

const sample = `# Rocket-Chat Documentation

> Knowledge base documentation for Rocket-Chat Documentation.

## v1

- [Rocket.Chat](https://docs.rocket.chat/docs/rocketchat.md): Discover Rocket Chat.
- [Deploy with Launchpad](https://docs.rocket.chat/docs/deploy-with-launchpad.md)
- [Our Plans](https://docs.rocket.chat/docs/our-plans.md): Compare plans.
`;

describe("parseLlmsTxt", () => {
	it("reads title, url and description from list entries", () => {
		expect(parseLlmsTxt(sample)[0]).toEqual({
			title: "Rocket.Chat",
			url: "https://docs.rocket.chat/docs/rocketchat.md",
			description: "Discover Rocket Chat.",
		});
	});

	it("accepts entries with no description", () => {
		const entry = parseLlmsTxt(sample)[1];
		expect(entry.title).toBe("Deploy with Launchpad");
		expect(entry.description).toBe("");
	});

	it("ignores headers, blockquotes and blank lines", () => {
		expect(parseLlmsTxt(sample)).toHaveLength(3);
	});

	it("keeps titles containing dots and colons intact", () => {
		const entries = parseLlmsTxt(
			"- [Rocket.Chat: Overview](https://docs.rocket.chat/docs/a.md): Body."
		);
		expect(entries[0].title).toBe("Rocket.Chat: Overview");
		expect(entries[0].description).toBe("Body.");
	});

	it("deduplicates repeated urls", () => {
		const entries = parseLlmsTxt(
			[
				"- [A](https://docs.rocket.chat/docs/a.md): one",
				"- [A again](https://docs.rocket.chat/docs/a.md): two",
			].join("\n")
		);
		expect(entries).toHaveLength(1);
		expect(entries[0].description).toBe("one");
	});

	it("returns nothing for text with no entries", () => {
		expect(parseLlmsTxt("# Title\n\n> just a description\n")).toEqual([]);
	});
});

describe("pageUrl", () => {
	it("maps a markdown url to its human page", () => {
		expect(pageUrl("https://docs.rocket.chat/docs/deploy.md")).toBe(
			"https://docs.rocket.chat/docs/deploy"
		);
	});

	it("leaves a url without the suffix alone", () => {
		expect(pageUrl("https://docs.rocket.chat/docs/deploy")).toBe(
			"https://docs.rocket.chat/docs/deploy"
		);
	});
});

describe("decodeUrlEntities", () => {
	it("restores a slug written with numeric entities", () => {
		expect(
			decodeUrlEntities(
				"https://docs.rocket.chat/docs/nomea&#231;&#227;o-do-encarregado.md"
			)
		).toBe("https://docs.rocket.chat/docs/nomeação-do-encarregado.md");
	});

	it("handles hex entities and escaped ampersands", () => {
		expect(decodeUrlEntities("https://x/a&#xE7;o.md")).toBe("https://x/aço.md");
		expect(decodeUrlEntities("https://x/a?b=1&amp;c=2")).toBe(
			"https://x/a?b=1&c=2"
		);
	});

	it("leaves a plain url untouched", () => {
		const url = "https://docs.rocket.chat/docs/deploy.md";
		expect(decodeUrlEntities(url)).toBe(url);
	});
});

describe("parseLlmsTxt url decoding", () => {
	it("decodes entities so the url actually resolves", () => {
		const entries = parseLlmsTxt(
			"- [Nomeação](https://docs.rocket.chat/docs/nomea&#231;&#227;o.md): x"
		);
		expect(entries[0].url).toBe("https://docs.rocket.chat/docs/nomeação.md");
	});
});
