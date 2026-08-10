import { describe, expect, it } from "vitest";

import { FetchError } from "./docFetch";

describe("FetchError", () => {
	it("treats rate limiting as retryable", () => {
		expect(new FetchError(429, null, "429").retryable).toBe(true);
	});

	it("treats server errors and timeouts as retryable", () => {
		expect(new FetchError(500, null, "500").retryable).toBe(true);
		expect(new FetchError(503, null, "503").retryable).toBe(true);
		expect(new FetchError(408, null, "408").retryable).toBe(true);
	});

	it("does not retry a missing page", () => {
		expect(new FetchError(404, null, "404").retryable).toBe(false);
		expect(new FetchError(403, null, "403").retryable).toBe(false);
	});

	it("carries the parsed retry-after delay", () => {
		expect(new FetchError(429, 30_000, "429").retryAfterMs).toBe(30_000);
	});
});
