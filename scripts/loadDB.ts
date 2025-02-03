import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai"

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import "dotenv/config"
import { config } from "dotenv";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean"

config();
const { ASTRA_DB_APPLICATION_TOKEN,
	ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTON, ASTRA_DB_API_ENDPOINT
 } = process.env;
const openai = new OpenAI();

const docData = [
	'https://docs.rocket.chat/',
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: 512,
	chunkOverlap: 100,
});

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
	const res = await db.createCollection(ASTRA_DB_COLLECTON, {
		vector: {
			dimension: 1536,
			metric: similarityMetric,
		}
	});
	console.log(res);
}

const loadSampleData = async () => {
	const collection = await db.collection(ASTRA_DB_COLLECTON)
	for await (const url of docData) {
		const content = await scrapePage(url);
		const chunks = await splitter.splitText(content);
		for await (const chunk of chunks) {
			const embedding = await openai.embeddings.create({
				model: "text-embedding-3-small",
				input: chunk,
				encoding_format: "float"
			});

			const vector = embedding.data[0].embedding;

			const res = await collection.insertOne({
				$vector: vector,
				text: chunk
			})
			console.log(res);
		}
	}
}

const scrapePage = async (url: string) => {
	const loader = new PuppeteerWebBaseLoader(url, {
		launchOptions: {
			headless: true,
		},
		gotoOptions: {
			waitUntil: "domcontentloaded"
		},
		evaluate: async (page, browser) => {
			const result = await page.evaluate(() => document.body.innerHTML);
			await browser.close();
			return result;
		}
	})
	return ( await loader.scrape())?.replace(/<[^>]*>?/gm, '');
}

createCollection().then(() => loadSampleData());