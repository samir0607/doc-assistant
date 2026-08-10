import { beforeEach, describe, expect, it } from "vitest";

import { clientKey, rateLimit } from "./rateLimit";

const WINDOW = 60_000;

describe("rateLimit", () => {
	let store: Map<string, number[]>;

	beforeEach(() => {
		store = new Map();
	});

	const call = (now: number, key = "ip") =>
		rateLimit({ key, limit: 3, windowMs: WINDOW, now, store });

	it("allows requests up to the limit", () => {
		expect(call(0).ok).toBe(true);
		expect(call(10).ok).toBe(true);
		expect(call(20).ok).toBe(true);
	});

	it("reports the remaining budget", () => {
		expect(call(0).remaining).toBe(2);
		expect(call(1).remaining).toBe(1);
		expect(call(2).remaining).toBe(0);
	});

	it("rejects once the limit is reached", () => {
		call(0);
		call(1);
		call(2);

		const blocked = call(3);
		expect(blocked.ok).toBe(false);
		expect(blocked.remaining).toBe(0);
	});

	it("reports how long to wait, rounded up to whole seconds", () => {
		call(0);
		call(1);
		call(2);
		expect(call(3).retryAfter).toBe(60);
		expect(call(WINDOW - 500).retryAfter).toBe(1);
	});

	it("lets the window slide rather than resetting in fixed blocks", () => {
		call(0);
		call(1);
		call(2);
		expect(call(1000).ok).toBe(false);
		expect(call(WINDOW + 1).ok).toBe(true);
	});

	it("does not let a rejected request consume budget", () => {
		call(0);
		call(1);
		call(2);
		call(3);
		call(4);
		expect(call(WINDOW + 1).ok).toBe(true);
	});

	it("tracks each key independently", () => {
		call(0, "a");
		call(1, "a");
		call(2, "a");
		expect(call(3, "a").ok).toBe(false);
		expect(call(3, "b").ok).toBe(true);
	});
});

describe("clientKey", () => {
	const withHeaders = (headers: Record<string, string>) =>
		new Request("https://example.test/api/chat", { headers });

	it("takes the leftmost x-forwarded-for entry", () => {
		expect(
			clientKey(withHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))
		).toBe("1.2.3.4");
	});

	it("falls back to x-real-ip", () => {
		expect(clientKey(withHeaders({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
	});

	it("returns a constant when no client hint is present", () => {
		expect(clientKey(withHeaders({}))).toBe("unknown");
	});
});
