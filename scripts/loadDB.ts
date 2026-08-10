import "dotenv/config";
import { DataAPIClient, type Collection, type Db } from "@datastax/astra-db-ts";

import { requireEnv } from "../lib/env";
import { chunkDocument, type Chunk } from "../lib/chunking";
import { fetchDocs } from "../lib/docFetch";
import { pageUrl } from "../lib/docIndex";
import { docRejectionReason } from "../lib/markdown";
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

const seed = async (fresh: boolean): Promise<Stats> => {
	const collection = await ensureCollection(getDb(), fresh);
	const stats: Stats = {
		pages: 0,
		inserted: 0,
		unchanged: 0,
		deleted: 0,
		failed: [],
	};

	let pending: Chunk[] = [];

	const flush = async (force: boolean) => {
		while (pending.length >= EMBED_BATCH || (force && pending.length > 0)) {
			const batch = pending.slice(0, EMBED_BATCH);
			pending = pending.slice(EMBED_BATCH);

			const documents = await chunksToDocuments(batch);
			for (let i = 0; i < documents.length; i += INSERT_BATCH) {
				await collection.insertMany(documents.slice(i, i + INSERT_BATCH), {
					ordered: false,
				});
			}
			stats.inserted += documents.length;
			console.log(
				`  … ${stats.inserted} chunks embedded from ${stats.pages} pages`
			);
		}
	};

	for await (const markdown of fetchDocs(DOC_URLS)) {
		stats.pages += 1;
		const doc = { ...markdown, url: pageUrl(markdown.url) };

		const rejection = docRejectionReason(doc);
		if (rejection) {
			console.warn(`! ${doc.url} — ${rejection}, skipping`);
			stats.failed.push(`${doc.url} (${rejection})`);
			continue;
		}

		const chunks = chunkDocument(doc);
		const wanted = new Set(chunks.map((chunk) => chunk.contentHash));
		const stored = fresh
			? new Set<string>()
			: await existingHashes(collection, doc.url);

		const toInsert = chunks.filter((chunk) => !stored.has(chunk.contentHash));
		const toDelete = [...stored].filter((id) => !wanted.has(id));

		stats.unchanged += chunks.length - toInsert.length;
		pending.push(...toInsert);

		if (toDelete.length > 0) {
			await collection.deleteMany({ _id: { $in: toDelete } });
			stats.deleted += toDelete.length;
		}

		await flush(false);
	}

	await flush(true);
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
