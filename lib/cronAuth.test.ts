import { describe, expect, it } from "vitest";

import { bearerToken, isCronAuthorised, secretsMatch } from "./cronAuth";

const withAuth = (value?: string) =>
	new Request("https://example.test/api/health", {
		headers: value === undefined ? {} : { authorization: value },
	});

describe("bearerToken", () => {
	it("reads the token from a bearer header", () => {
		expect(bearerToken("Bearer abc123")).toBe("abc123");
	});

	it("accepts any capitalisation of the scheme", () => {
		expect(bearerToken("bearer abc123")).toBe("abc123");
		expect(bearerToken("BEARER abc123")).toBe("abc123");
	});

	it("tolerates surrounding whitespace", () => {
		expect(bearerToken("  Bearer   abc123  ")).toBe("abc123");
	});

	it("rejects other schemes and malformed headers", () => {
		expect(bearerToken("Basic abc123")).toBeNull();
		expect(bearerToken("Bearer")).toBeNull();
		expect(bearerToken("Bearer ")).toBeNull();
		expect(bearerToken(null)).toBeNull();
	});
});

describe("secretsMatch", () => {
	it("accepts identical secrets", () => {
		expect(secretsMatch("s3cret", "s3cret")).toBe(true);
	});

	it("rejects different secrets of equal length", () => {
		expect(secretsMatch("s3cret", "s3creT")).toBe(false);
	});

	it("rejects different lengths without throwing", () => {
		expect(secretsMatch("short", "a-much-longer-secret")).toBe(false);
	});

	it("handles multi-byte characters", () => {
		expect(secretsMatch("señal", "señal")).toBe(true);
		expect(secretsMatch("señal", "senal")).toBe(false);
	});
});

describe("isCronAuthorised", () => {
	it("allows any caller when no secret is configured", () => {
		expect(isCronAuthorised(withAuth(), undefined)).toBe(true);
		expect(isCronAuthorised(withAuth(), "")).toBe(true);
	});

	it("accepts the configured secret", () => {
		expect(isCronAuthorised(withAuth("Bearer s3cret"), "s3cret")).toBe(true);
	});

	it("rejects a wrong or missing token once a secret is set", () => {
		expect(isCronAuthorised(withAuth("Bearer nope"), "s3cret")).toBe(false);
		expect(isCronAuthorised(withAuth(), "s3cret")).toBe(false);
		expect(isCronAuthorised(withAuth("s3cret"), "s3cret")).toBe(false);
	});
});
