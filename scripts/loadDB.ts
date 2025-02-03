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
const db = client.db(ASTRA_DB_API_ENDPOINT, ASTRA_DB_NAMESPACE);

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
