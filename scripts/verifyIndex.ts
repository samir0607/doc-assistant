import "dotenv/config";

import { pageUrl } from "../lib/docIndex";
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

	console.error(`\n${missing.length} listed pages are missing from the index:`);
	for (const url of missing.slice(0, 40)) console.error(`  - ${url}`);
	if (missing.length > 40) {
		console.error(`  … and ${missing.length - 40} more`);
	}
	process.exitCode = 1;
};

main().catch((e) => {
	console.error("\nVerification failed:", e);
	process.exit(1);
});
