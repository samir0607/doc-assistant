import OpenAI from "openai";
import { DataAPIClient, type Collection } from "@datastax/astra-db-ts";

import { requireEnv } from "./env";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;
export const SIMILARITY_METRIC = "cosine" as const;

const CANDIDATE_LIMIT = 30;
const CONTEXT_LIMIT = 8;
const MIN_SIMILARITY = 0.3;
const MAX_PER_URL = 3;

export type RetrievedChunk = {
	url: string;
	title: string;
	section: string;
	body: string;
	similarity: number;
};

export type RankOptions = {
	minSimilarity?: number;
	maxPerUrl?: number;
	limit?: number;
};

export const rankChunks = (
	candidates: readonly RetrievedChunk[],
	options: RankOptions = {}
): RetrievedChunk[] => {
	const {
		minSimilarity = MIN_SIMILARITY,
		maxPerUrl = MAX_PER_URL,
		limit = CONTEXT_LIMIT,
	} = options;

	const seenBodies = new Set<string>();
	const perUrl = new Map<string, number>();
	const ranked: RetrievedChunk[] = [];

	const ordered = [...candidates].sort((a, b) => b.similarity - a.similarity);

	for (const chunk of ordered) {
		if (ranked.length >= limit) break;
		if (chunk.similarity < minSimilarity) continue;

		const fingerprint = chunk.body.trim();
		if (!fingerprint || seenBodies.has(fingerprint)) continue;

		const used = perUrl.get(chunk.url) ?? 0;
		if (used >= maxPerUrl) continue;

		seenBodies.add(fingerprint);
		perUrl.set(chunk.url, used + 1);
		ranked.push(chunk);
	}

	return ranked;
};

export type Source = { index: number; url: string; title: string };

export const toSources = (chunks: readonly RetrievedChunk[]): Source[] => {
	const byUrl = new Map<string, Source>();

	for (const chunk of chunks) {
		if (byUrl.has(chunk.url)) continue;
		byUrl.set(chunk.url, {
			index: byUrl.size + 1,
			url: chunk.url,
			title: chunk.title || chunk.section || chunk.url,
		});
	}

	return [...byUrl.values()];
};

export const citationNumbers = (
	sources: readonly Source[]
): Map<string, number> => new Map(sources.map((s) => [s.url, s.index]));

let embeddingClient: OpenAI | null = null;

export const getEmbeddingClient = (): OpenAI => {
	embeddingClient ??= new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
	return embeddingClient;
};

let collection: Collection | null = null;

export const getCollection = (): Collection => {
	if (!collection) {
		const client = new DataAPIClient(requireEnv("ASTRA_DB_APPLICATION_TOKEN"));
		const db = client.db(requireEnv("ASTRA_DB_API_ENDPOINT"), {
			namespace: requireEnv("ASTRA_DB_NAMESPACE"),
		});
		collection = db.collection(requireEnv("ASTRA_DB_COLLECTION"));
	}
	return collection;
};

export const embed = async (input: string | string[]): Promise<number[][]> => {
	const response = await getEmbeddingClient().embeddings.create({
		model: EMBEDDING_MODEL,
		input,
		encoding_format: "float",
	});
	return [...response.data]
		.sort((a, b) => a.index - b.index)
		.map((item) => item.embedding);
};

export const retrieve = async (
	query: string,
	options: RankOptions = {}
): Promise<RetrievedChunk[]> => {
	const [vector] = await embed(query);

	const cursor = getCollection().find(
		{},
		{
			sort: { $vector: vector },
			limit: CANDIDATE_LIMIT,
			includeSimilarity: true,
			projection: { text: 1, body: 1, url: 1, title: 1, section: 1 },
		}
	);

	const candidates = (await cursor.toArray()).map((doc): RetrievedChunk => ({
		url: (doc.url as string) ?? "",
		title: (doc.title as string) ?? "",
		section: (doc.section as string) ?? "",
		body: ((doc.body ?? doc.text) as string) ?? "",
		similarity: (doc.$similarity as number) ?? 0,
	}));

	return rankChunks(candidates, options);
};
