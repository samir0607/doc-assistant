import { describe, expect, it } from "vitest";

import { condensePrompt, renderContext, systemPrompt } from "./prompts";
import { toSources, type RetrievedChunk } from "./retrieval";

const chunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
	url: "https://docs.rocket.chat/docs/deploy",
	title: "Deploy",
	section: "Deploy > Docker",
	body: "Run docker compose up.",
	similarity: 0.9,
	...overrides,
});

describe("renderContext", () => {
	it("numbers blocks from one and names the source url", () => {
		const rendered = renderContext([
			chunk(),
			chunk({ url: "https://docs.rocket.chat/docs/aws", section: "Deploy > AWS" }),
		]);

		expect(rendered).toContain("[1] Deploy > Docker");
		expect(rendered).toContain("Source: https://docs.rocket.chat/docs/deploy");
		expect(rendered).toContain("[2] Deploy > AWS");
		expect(rendered).toContain("Source: https://docs.rocket.chat/docs/aws");
	});

	it("labels a block with its title when it has no section", () => {
		expect(renderContext([chunk({ section: "" })])).toContain("[1] Deploy");
	});

	it("includes the chunk body verbatim", () => {
		expect(renderContext([chunk()])).toContain("Run docker compose up.");
	});

	it("gives two chunks from the same page the same citation number", () => {
		const rendered = renderContext([
			chunk({ section: "Deploy > Docker", body: "first" }),
			chunk({ section: "Deploy > Compose", body: "second" }),
		]);

		expect(rendered).toContain("[1] Deploy > Docker");
		expect(rendered).toContain("[1] Deploy > Compose");
		expect(rendered).not.toContain("[2]");
	});

	it("never labels a block with a number the client won't show", () => {
		const chunks = [
			chunk({ url: "https://a", body: "a1" }),
			chunk({ url: "https://a", body: "a2" }),
			chunk({ url: "https://b", body: "b1" }),
		];
		const sources = toSources(chunks);
		const labels = [...renderContext(chunks, sources).matchAll(/^\[(\d+)\]/gm)].map(
			(m) => Number(m[1])
		);

		const shown = new Set(sources.map((s) => s.index));
		for (const label of labels) expect(shown.has(label)).toBe(true);
	});
});

describe("systemPrompt", () => {
	it("asks for inline citations when context exists", () => {
		const prompt = systemPrompt([chunk()]);
		expect(prompt).toMatch(/\[1\] or \[2\]\[3\]/);
		expect(prompt).toContain("START CONTEXT");
		expect(prompt).toContain("Run docker compose up.");
	});

	it("instructs a refusal when retrieval found nothing", () => {
		const prompt = systemPrompt([]);
		expect(prompt).toContain("No relevant documentation was found");
		expect(prompt).toContain("Do not answer from prior knowledge");
		expect(prompt).not.toContain("START CONTEXT");
	});
});

describe("condensePrompt", () => {
	it("renders the transcript with speaker labels", () => {
		const prompt = condensePrompt(
			[
				{ role: "user", content: "How do I deploy with Docker?" },
				{ role: "assistant", content: "Use docker compose." },
			],
			"how about on AWS?"
		);

		expect(prompt).toContain("User: How do I deploy with Docker?");
		expect(prompt).toContain("Assistant: Use docker compose.");
		expect(prompt).toContain("Follow-up question: how about on AWS?");
	});

	it("asks for the question only, with no preamble", () => {
		const prompt = condensePrompt([], "what is it?");
		expect(prompt).toContain("Output only the rewritten question");
	});
});
