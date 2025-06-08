import { DataAPIClient } from "@datastax/astra-db-ts";
import OpenAI from "openai"

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import "dotenv/config"
import { config } from "dotenv";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean"

config();
const { ASTRA_DB_APPLICATION_TOKEN,
	ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, SCRAPER_API_KEY
 } = process.env;
const openai = new OpenAI();

const docData = [
	'https://docs.rocket.chat/',
	'https://docs.rocket.chat/docs',
	'https://docs.rocket.chat/docs/our-plans',
	'https://docs.rocket.chat/docs/deploy-rocketchat',
	'https://docs.rocket.chat/docs/system-requirements',
	'https://docs.rocket.chat/docs/deploy-with-docker-docker-compose',
	'https://docs.rocket.chat/docs/deploy-with-aws',
	'https://docs.rocket.chat/docs/deploy-with-kubernetes',
	'https://docs.rocket.chat/docs/configuring-rocketchat-with-kubernetes',
	'https://docs.rocket.chat/docs/deploy-with-snaps',
	'https://docs.rocket.chat/docs/updating-rocketchat',
	'https://developer.rocket.chat/docs/rocketchat-developer',
	'https://developer.rocket.chat/docs/architecture-and-components',
	'https://developer.rocket.chat/docs/deploy-rocketchat',
	'https://gist.github.com/reetp/b0ba4e3d0ea2ff48ca9da00a5a647d42#introduction'
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: 512,
	chunkOverlap: 100,
});

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
	const res = await db.createCollection(ASTRA_DB_COLLECTION, {
		vector: {
			dimension: 1536,
			metric: similarityMetric,
		}
	});
	console.log(res);
}

const loadSampleData = async () => {
	const collection = await db.collection(ASTRA_DB_COLLECTION)
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
	if (!url) {
		throw new Error('Please provide a valid URL.');
	}

	const scrapeUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=true`;

		const response = await fetch(scrapeUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
		}

		const htmlContent = await response.text();

		const textContent = htmlContent
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ') 
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')   
			.replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')      
			.replace(/<\/?[^>]+(>|$)/g, '')                    
			.replace(/^\s+|\s+$/gm, '')
			.replace(/\n{2,}/g, '\n\n');                       

		return textContent;
}

createCollection().then(() => loadSampleData());