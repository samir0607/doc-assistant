import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { fetchDocIndex, LLMS_INDEXES } from "../lib/docIndex";

const TARGET = resolve(__dirname, "../lib/doc-urls.json");

const main = async () => {
	console.log(`Reading ${LLMS_INDEXES.length} documentation indexes…`);
	for (const index of LLMS_INDEXES) console.log(`  ${index}`);

	const entries = await fetchDocIndex();
	const urls = entries.map((entry) => entry.url);

	writeFileSync(TARGET, `${JSON.stringify(urls, null, "\t")}\n`);

	const byHost = new Map<string, number>();
	for (const url of urls) {
		const host = new URL(url).hostname;
		byHost.set(host, (byHost.get(host) ?? 0) + 1);
	}

	console.log(`\n${urls.length} pages written to lib/doc-urls.json`);
	for (const [host, count] of byHost) console.log(`  ${count}\t${host}`);
	console.log("\nReview the diff, then run `npm run seed` to index new pages.");
};

main().catch((e) => {
	console.error("\nDiscovery failed:", e);
	process.exit(1);
});
