import { describe, expect, it } from "vitest";

import { buildSearchQuery } from "./query";

describe("buildSearchQuery", () => {
	it("uses a first question verbatim, without calling a model", async () => {
		const query = await buildSearchQuery([
			{ role: "user", content: "How do I deploy with Docker?" },
		]);

		expect(query).toBe("How do I deploy with Docker?");
	});

	it("ignores a leading system message when deciding there is no history", async () => {
		const query = await buildSearchQuery([
			{ role: "system", content: "You are R8." },
			{ role: "user", content: "What are the system requirements?" },
		]);

		expect(query).toBe("What are the system requirements?");
	});

	it("returns an empty string for an empty conversation", async () => {
		expect(await buildSearchQuery([])).toBe("");
	});
});
