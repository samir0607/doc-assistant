import "dotenv/config";
import { DataAPIClient, type Collection, type Db } from "@datastax/astra-db-ts";

import { requireEnv } from "../lib/env";
import { chunkDocument, type Chunk } from "../lib/chunking";
import { scrapePages, type ScrapedDoc } from "../lib/scrape";
import { DOC_URLS } from "../lib/sources";
import {
	embed,
	EMBEDDING_DIMENSION,
	SIMILARITY_METRIC,
} from "../lib/retrieval";

const EMBED_BATCH = 96;
const INSERT_BATCH = 20;

type Stats = {
	pages: number;
	inserted: number;
	unchanged: number;
	deleted: number;
	failed: string[];
};

const getDb = (): Db => {
	const client = new DataAPIClient(requireEnv("ASTRA_DB_APPLICATION_TOKEN"));
	return client.db(requireEnv("ASTRA_DB_API_ENDPOINT"), {
		namespace: requireEnv("ASTRA_DB_NAMESPACE"),
	});
};

const ensureCollection = async (db: Db, fresh: boolean): Promise<Collection> => {
	const name = requireEnv("ASTRA_DB_COLLECTION");

	if (fresh) {
		console.log(`Dropping collection "${name}"…`);
		await db.dropCollection(name).catch((e) => {
			console.log(`  (nothing to drop: ${(e as Error).message})`);
		});
	}

	const existing = await db.listCollections({ nameOnly: true });
	if (!existing.includes(name)) {
		console.log(`Creating collection "${name}" (${SIMILARITY_METRIC})…`);
		await db.createCollection(name, {
			vector: { dimension: EMBEDDING_DIMENSION, metric: SIMILARITY_METRIC },
		});
	}

	return db.collection(name);
};

const existingHashes = async (
	collection: Collection,
	url: string
): Promise<Set<string>> => {
	const cursor = collection.find({ url }, { projection: { _id: 1 } });
	const docs = await cursor.toArray();
	return new Set(docs.map((doc) => String(doc._id)));
};

const chunksToDocuments = async (chunks: Chunk[]) => {
	const documents: Record<string, unknown>[] = [];

	for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
		const batch = chunks.slice(i, i + EMBED_BATCH);
		const vectors = await embed(batch.map((chunk) => chunk.text));

		batch.forEach((chunk, index) => {
			documents.push({
				_id: chunk.contentHash,
				$vector: vectors[index],
				url: chunk.url,
				title: chunk.title,
				section: chunk.section,
				chunkIndex: chunk.chunkIndex,
				contentHash: chunk.contentHash,
				body: chunk.body,
				text: chunk.text,
			});
		});
	}

	return documents;
};

const MIN_DOC_CHARS = 500;

const rejectDoc = (doc: ScrapedDoc): string | null => {
	if (doc.blocked) return "bot-check interstitial";
	if (!doc.text) return "no text extracted";
	if (doc.text.length < MIN_DOC_CHARS) {
		return `only ${doc.text.length} chars`;
	}
	return null;
};

const seed = async (fresh: boolean): Promise<Stats> => {
	const collection = await ensureCollection(getDb(), fresh);
	const stats: Stats = {
		pages: 0,
		inserted: 0,
		unchanged: 0,
		deleted: 0,
		failed: [],
	};

	for await (const doc of scrapePages(DOC_URLS)) {
		stats.pages += 1;

		const rejection = rejectDoc(doc);
		if (rejection) {
			console.warn(`! ${doc.url} — ${rejection}, skipping`);
			stats.failed.push(`${doc.url} (${rejection})`);
			continue;
		}

		const chunks = chunkDocument(doc);
		const wanted = new Set(chunks.map((chunk) => chunk.contentHash));
		const stored = fresh ? new Set<string>() : await existingHashes(collection, doc.url);

		const toInsert = chunks.filter((chunk) => !stored.has(chunk.contentHash));
		const toDelete = [...stored].filter((id) => !wanted.has(id));

		console.log(
			`• ${doc.title || doc.url} — ${chunks.length} chunks ` +
				`(+${toInsert.length} new, =${chunks.length - toInsert.length} unchanged, ` +
				`-${toDelete.length} stale)`
		);

		if (toInsert.length > 0) {
			const documents = await chunksToDocuments(toInsert);
			for (let i = 0; i < documents.length; i += INSERT_BATCH) {
				const batch = documents.slice(i, i + INSERT_BATCH);
				await collection.insertMany(batch, { ordered: false });
			}
			stats.inserted += documents.length;
		}

		stats.unchanged += chunks.length - toInsert.length;

		if (toDelete.length > 0) {
			await collection.deleteMany({ _id: { $in: toDelete } });
			stats.deleted += toDelete.length;
		}
	}

	return stats;
};

const main = async () => {
	const fresh = process.argv.includes("--fresh");
	for (const name of [
		"OPENAI_API_KEY",
		"ASTRA_DB_APPLICATION_TOKEN",
		"ASTRA_DB_API_ENDPOINT",
		"ASTRA_DB_NAMESPACE",
		"ASTRA_DB_COLLECTION",
	]) {
		requireEnv(name);
	}

	console.log(
		`Seeding ${DOC_URLS.length} pages (${fresh ? "fresh rebuild" : "incremental"})…\n`
	);

	const stats = await seed(fresh);

	console.log(
		`\nDone. ${stats.pages} pages · ${stats.inserted} embedded · ` +
			`${stats.unchanged} unchanged · ${stats.deleted} removed`
	);
	if (stats.failed.length > 0) {
		console.warn(`\nPages that yielded no usable text:`);
		for (const url of stats.failed) console.warn(`  - ${url}`);
	}
};

main().catch((e) => {
	console.error("\nSeeding failed:", e);
	process.exit(1);
});
