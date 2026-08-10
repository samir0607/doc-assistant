import "dotenv/config";

import { fetchDoc } from "../lib/docFetch";
import { pageUrl } from "../lib/docIndex";
import { docRejectionReason } from "../lib/markdown";
import { getCollection } from "../lib/retrieval";
import { DOC_URLS } from "../lib/sources";

const main = async () => {
	const expected = new Set(DOC_URLS.map(pageUrl));

	const cursor = getCollection().find({}, { projection: { url: 1 } });
	const chunksPerUrl = new Map<string, number>();

	for await (const doc of cursor) {
		const url = doc.url as string;
		if (!url) continue;
		chunksPerUrl.set(url, (chunksPerUrl.get(url) ?? 0) + 1);
	}

	const indexed = new Set(chunksPerUrl.keys());
	const missing = [...expected].filter((url) => !indexed.has(url)).sort();
	const orphaned = [...indexed].filter((url) => !expected.has(url)).sort();
	const chunks = [...chunksPerUrl.values()].reduce((a, b) => a + b, 0);

	console.log(`Expected pages : ${expected.size}`);
	console.log(`Indexed pages  : ${indexed.size}`);
	console.log(`Stored chunks  : ${chunks}`);
	console.log(
		`Chunks/page    : ${(chunks / Math.max(indexed.size, 1)).toFixed(1)} average`
	);

	if (orphaned.length > 0) {
		console.warn(`\n${orphaned.length} indexed pages are no longer listed:`);
		for (const url of orphaned.slice(0, 20)) console.warn(`  - ${url}`);
		console.warn(`  Run \`npm run seed\` to prune them.`);
	}

	if (missing.length === 0) {
		console.log(`\nEvery listed page is present in the index.`);
		return;
	}

	// A page can be absent for two very different reasons: it holds no content
	// upstream, which is a fact about the docs and nothing to fix, or we failed
	// to index something real. Re-fetch to tell them apart, so this check stays
	// green while the docs carry empty stubs and goes red only when it matters.
	console.log(`\nChecking why ${missing.length} pages are absent…`);

	const empty: string[] = [];
	const real: string[] = [];

	for (const url of missing) {
		const doc = await fetchDoc(`${url}.md`);
		const reason = doc.error ?? docRejectionReason(doc);
		if (doc.error) {
			real.push(`${url} — ${doc.error}`);
		} else if (reason) {
			empty.push(`${url} — ${reason}`);
		} else {
			real.push(`${url} — has content but was not indexed`);
		}
	}

	if (empty.length > 0) {
		console.log(`\n${empty.length} are empty upstream, correctly skipped:`);
		for (const line of empty) console.log(`  · ${line}`);
	}

	if (real.length === 0) {
		console.log(`\nEvery page with content is indexed.`);
		return;
	}

	console.error(`\n${real.length} pages are genuinely missing:`);
	for (const line of real) console.error(`  - ${line}`);
	process.exitCode = 1;
};

main().catch((e) => {
	console.error("\nVerification failed:", e);
	process.exit(1);
});
