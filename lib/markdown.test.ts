import { describe, expect, it } from "vitest";

import {
	docRejectionReason,
	firstHeading,
	markdownToDoc,
	parseFrontmatter,
	stripIndexNotice,
} from "./markdown";

const NOTICE = [
	"> ## Documentation Index",
	"> Fetch the complete documentation index at: https://docs.rocket.chat/llms.txt",
	"> Use this file to discover all available pages before exploring further.",
].join("\n");

describe("parseFrontmatter", () => {
	it("reads quoted and unquoted values", () => {
		const { frontmatter } = parseFrontmatter(
			['---', 'title: "Deploy"', "slug: deploy", "---", "body"].join("\n")
		);
		expect(frontmatter.title).toBe("Deploy");
		expect(frontmatter.slug).toBe("deploy");
	});

	it("keeps colons inside values", () => {
		const { frontmatter } = parseFrontmatter(
			["---", "updated: 2026-08-03T16:02:40Z", "---", "body"].join("\n")
		);
		expect(frontmatter.updated).toBe("2026-08-03T16:02:40Z");
	});

	it("returns the body without the frontmatter block", () => {
		const { body } = parseFrontmatter(
			["---", "title: A", "---", "# Heading", "text"].join("\n")
		);
		expect(body).toBe("# Heading\ntext");
	});

	it("passes through content that has no frontmatter", () => {
		const raw = "# Heading\n\ntext";
		expect(parseFrontmatter(raw)).toEqual({ frontmatter: {}, body: raw });
	});

	it("does not treat a horizontal rule mid-document as frontmatter", () => {
		const raw = "# Heading\n\n---\n\nmore";
		expect(parseFrontmatter(raw).frontmatter).toEqual({});
	});
});

describe("stripIndexNotice", () => {
	it("removes the injected index blockquote", () => {
		const body = `${NOTICE}\n\n# Deploy\n\nReal content.`;
		expect(stripIndexNotice(body)).toBe("# Deploy\n\nReal content.");
	});

	it("keeps a genuine leading blockquote", () => {
		const body = "> [!NOTE]\n> Upgrade first.\n\n# Deploy";
		expect(stripIndexNotice(body)).toBe(body);
	});

	it("leaves a document that starts with a heading alone", () => {
		const body = "# Deploy\n\nContent.";
		expect(stripIndexNotice(body)).toBe(body);
	});
});

describe("markdownToDoc", () => {
	const raw = [
		"---",
		'title: "Deploy with Docker"',
		'slug: "deploy-with-docker"',
		"---",
		"",
		NOTICE,
		"",
		"# Deploy with Docker",
		"",
		"Run `docker compose up -d`.",
	].join("\n");

	it("takes the title from frontmatter", () => {
		expect(markdownToDoc("https://x/docs/a.md", raw).title).toBe(
			"Deploy with Docker"
		);
	});

	it("drops frontmatter and the index notice from the text", () => {
		const { text } = markdownToDoc("https://x/docs/a.md", raw);
		expect(text).toBe("# Deploy with Docker\n\nRun `docker compose up -d`.");
	});

	it("is deterministic for identical input", () => {
		const a = markdownToDoc("https://x/docs/a.md", raw);
		const b = markdownToDoc("https://x/docs/a.md", raw);
		expect(a).toEqual(b);
	});

	it("yields an empty title when there is neither frontmatter nor a heading", () => {
		expect(markdownToDoc("https://x/docs/a.md", "just prose").title).toBe("");
	});
});

describe("firstHeading", () => {
	it("reads the first level-one heading", () => {
		expect(firstHeading("# Add License\n\nBody.")).toBe("Add License");
	});

	it("ignores deeper headings", () => {
		expect(firstHeading("## Changelog\n\n# Real Title")).toBe("Real Title");
	});

	it("returns an empty string when there is no heading", () => {
		expect(firstHeading("Just prose.")).toBe("");
	});
});

describe("markdownToDoc without frontmatter", () => {
	it("falls back to the first heading for the title", () => {
		const raw = `${NOTICE}\n\n# Add License\n\nPermission required.`;
		expect(markdownToDoc("https://x/apidocs/add-license.md", raw).title).toBe(
			"Add License"
		);
	});
});

describe("docRejectionReason", () => {
	const doc = (text: string) => ({ url: "https://x/docs/a", title: "A", text });

	it("accepts a short but real page", () => {
		expect(docRejectionReason(doc("x".repeat(300)))).toBeNull();
	});

	it("rejects an empty page as unreachable", () => {
		expect(docRejectionReason(doc(""))).toBe("empty or unreachable");
	});

	it("rejects a stub too small to be a page", () => {
		expect(docRejectionReason(doc("Coming soon."))).toBe("only 12 chars");
	});
});
