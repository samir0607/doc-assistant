const BLOCK_TAGS = "p|div|section|article|tr|blockquote|pre|figcaption";

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	mdash: "—",
	ndash: "–",
	hellip: "…",
	rsquo: "’",
	lsquo: "‘",
	rdquo: "”",
	ldquo: "“",
};

export const decodeEntities = (text: string): string =>
	text
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16))
		)
		.replace(/&#(\d+);/g, (_, dec) =>
			String.fromCodePoint(Number.parseInt(dec, 10))
		)
		.replace(/&([a-z]+);/gi, (match, name: string) => {
			return NAMED_ENTITIES[name.toLowerCase()] ?? match;
		});

export const extractTitle = (html: string): string => {
	const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
	if (title) {
		return decodeEntities(title).split(/\s*[|·—–]\s*/)[0].trim();
	}
	const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
	return h1 ? decodeEntities(h1.replace(/<[^>]+>/g, "")).trim() : "";
};

export const htmlToText = (html: string): string => {
	let text = html;

	text = text.replace(
		/<(script|style|noscript|svg|head|nav|footer|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
		"\n"
	);

	text = text.replace(
		/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
		(_, level: string, inner: string) => {
			const heading = decodeEntities(inner.replace(/<[^>]+>/g, " "))
				.replace(/\s+/g, " ")
				.trim();
			return heading ? `\n\n${"#".repeat(Number(level))} ${heading}\n\n` : "\n";
		}
	);

	text = text
		.replace(/<li\b[^>]*>/gi, "\n- ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(new RegExp(`</(${BLOCK_TAGS})>`, "gi"), "\n\n")
		.replace(/<\/(li|ul|ol|table|h[1-6])>/gi, "\n")
		.replace(/<[^>]+>/g, "");

	return decodeEntities(text)
		.replace(/\r/g, "")
		.replace(/[ \t]+/g, " ")
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
};

export type ScrapedDoc = {
	url: string;
	title: string;
	text: string;
	blocked: boolean;
};

export const htmlToDoc = (url: string, html: string): ScrapedDoc => ({
	url,
	title: extractTitle(html),
	text: htmlToText(html),
	blocked: isChallengePage(html),
});

const CHALLENGE_TITLES =
	/^(just a moment|attention required|access denied|please wait|security check|verifying)/i;

const CHALLENGE_MARKERS = [
	"cf-browser-verification",
	"cf_chl_opt",
	"__cf_chl",
	"challenge-platform",
	"enable javascript and cookies to continue",
];

export const isChallengePage = (html: string): boolean => {
	if (CHALLENGE_TITLES.test(extractTitle(html).trim())) return true;
	const haystack = html.toLowerCase();
	return CHALLENGE_MARKERS.some((marker) => haystack.includes(marker));
};

const CHALLENGE_RETRIES = 4;
const CHALLENGE_WAIT_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function* scrapePages(
	urls: readonly string[]
): AsyncGenerator<ScrapedDoc> {
	const { default: puppeteer } = await import("puppeteer");
	const browser = await puppeteer.launch({
		args: ["--disable-blink-features=AutomationControlled"],
	});

	const userAgent = (await browser.userAgent()).replace(
		"HeadlessChrome",
		"Chrome"
	);

	try {
		for (const url of urls) {
			const page = await browser.newPage();
			try {
				await page.setUserAgent(userAgent);
				await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
				await page.setViewport({ width: 1280, height: 900 });
				await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });

				let html = await page.content();
				for (
					let attempt = 1;
					attempt <= CHALLENGE_RETRIES && isChallengePage(html);
					attempt += 1
				) {
					await sleep(CHALLENGE_WAIT_MS);
					html = await page.content();
				}

				yield htmlToDoc(url, html);
			} finally {
				await page.close();
			}
		}
	} finally {
		await browser.close();
	}
}
