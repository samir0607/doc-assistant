import { describe, expect, it } from "vitest";

import {
	decodeEntities,
	extractTitle,
	htmlToDoc,
	htmlToText,
	isChallengePage,
} from "./scrape";

describe("decodeEntities", () => {
	it("decodes named, decimal and hex entities", () => {
		expect(decodeEntities("a &amp; b")).toBe("a & b");
		expect(decodeEntities("&lt;tag&gt;")).toBe("<tag>");
		expect(decodeEntities("&#39;quoted&#39;")).toBe("'quoted'");
		expect(decodeEntities("&#x2014;")).toBe("—");
	});

	it("leaves unknown entities untouched", () => {
		expect(decodeEntities("&notarealentity;")).toBe("&notarealentity;");
	});
});

describe("extractTitle", () => {
	it("reads the title tag and strips the site suffix", () => {
		expect(
			extractTitle("<title>Deploy with Docker | Rocket.Chat Docs</title>")
		).toBe("Deploy with Docker");
	});

	it("falls back to the first h1", () => {
		expect(extractTitle("<h1>System <em>Requirements</em></h1>")).toBe(
			"System Requirements"
		);
	});

	it("returns an empty string when there is nothing to read", () => {
		expect(extractTitle("<p>body only</p>")).toBe("");
	});
});

describe("htmlToText", () => {
	it("preserves heading levels as ATX headings", () => {
		const text = htmlToText("<h2>Docker</h2><p>Run it.</p><h3>Notes</h3><p>Ok.</p>");
		expect(text).toContain("## Docker");
		expect(text).toContain("### Notes");
	});

	it("drops scripts, styles and navigation entirely", () => {
		const text = htmlToText(
			[
				"<nav>Skip me</nav>",
				"<script>var secret = 1;</script>",
				"<style>.a{color:red}</style>",
				"<p>Keep me.</p>",
			].join("")
		);

		expect(text).toBe("Keep me.");
	});

	it("turns list items into markdown bullets", () => {
		const text = htmlToText("<ul><li>One</li><li>Two</li></ul>");
		expect(text).toContain("- One");
		expect(text).toContain("- Two");
	});

	it("collapses runs of blank lines", () => {
		const text = htmlToText("<p>A</p><div></div><div></div><p>B</p>");
		expect(text).not.toMatch(/\n{3}/);
	});

	it("keeps heading text on its own line so the chunker can see it", () => {
		const text = htmlToText("<p>Before</p><h2>Middle</h2><p>After</p>");
		const lines = text.split("\n").filter(Boolean);
		expect(lines).toContain("## Middle");
	});

	it("strips attributes and inline markup without eating content", () => {
		const text = htmlToText(
			'<p class="x">Use <code>docker compose up</code> to <b>start</b>.</p>'
		);
		expect(text).toBe("Use docker compose up to start.");
	});
});

describe("isChallengePage", () => {
	it("recognises the Cloudflare interstitial by title", () => {
		expect(
			isChallengePage("<title>Just a moment...</title><body>checking</body>")
		).toBe(true);
	});

	it("recognises it by body markers even when the title looks normal", () => {
		expect(
			isChallengePage(
				'<title>Deploy Rocket.Chat</title><div id="cf-browser-verification"></div>'
			)
		).toBe(true);
	});

	it("catches the javascript-and-cookies notice", () => {
		expect(
			isChallengePage("<p>Enable JavaScript and cookies to continue</p>")
		).toBe(true);
	});

	it("passes a real documentation page through", () => {
		expect(
			isChallengePage(
				"<title>Deploy with Docker | Rocket.Chat</title><h2>Docker</h2><p>Run compose.</p>"
			)
		).toBe(false);
	});
});

describe("htmlToDoc", () => {
	it("flags a blocked page so callers refuse to index it", () => {
		const doc = htmlToDoc(
			"https://docs.rocket.chat/docs/deploy",
			"<title>Just a moment...</title><body>checking your browser</body>"
		);
		expect(doc.blocked).toBe(true);
	});

	it("carries url, title and text for a real page", () => {
		const doc = htmlToDoc(
			"https://docs.rocket.chat/docs/deploy",
			"<title>Deploy | Rocket.Chat</title><h2>Docker</h2><p>Run compose.</p>"
		);

		expect(doc).toMatchObject({
			url: "https://docs.rocket.chat/docs/deploy",
			title: "Deploy",
			blocked: false,
		});
		expect(doc.text).toContain("## Docker");
	});
});
