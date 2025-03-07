import OpenAI from "openai";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
	ASTRA_DB_APPLICATION_TOKEN,
	ASTRA_DB_NAMESPACE,
	ASTRA_DB_COLLECTION,
	ASTRA_DB_API_ENDPOINT,
	OPENAI_API_KEY,
} = process.env;

const ai = new OpenAI({ apiKey: OPENAI_API_KEY})

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE })

export async function POST(req: Request) {
	try{
		const { messages } = await req.json()
		const latestMessage = messages[messages?.length-1]?.content
		let docContext = ""

		const embedding = await ai.embeddings.create({
			model: "text-embedding-3-small",
			input: latestMessage,
			encoding_format: "float"
		})

		try{
			const collection = await db.collection(ASTRA_DB_COLLECTION)
			const cursor = collection.find(null, {
				sort: {
					$vector: embedding.data[0].embedding,
				},
				limit: 30
			})
		  const documents = await cursor.toArray()
			const docsMap = documents?.map(doc => doc.text)
			docContext = JSON.stringify(docsMap)
		} catch (e){
			console.error("Error querying Database...")
			throw e
		}
		const template = {
			role: "system",
			content: `You are an AI assistant who knows about Rocket.Chat documentation. 
			Use the context below to augment what you know about Rocket.Chat documentation.
			The context will provide you with the most recent data from docs.rocket.chat the official documentation page of rocket.chat and others related to rocket chat apps like embedded chats.
			If the context doesn't include the information answer based on you existing knowledge.
			Format responses using markdown where applicable and don't return images.
		---------------
		START CONTEXT
		${docContext}
		END CONTEXT
		---------------
		QUESTION:  ${latestMessage}
		---------------
		`,
		}
		const response = await streamText({
			model: openai("gpt-4o-mini"),
			messages: [template, ...messages]
		})
		return response.toDataStreamResponse()
	} catch (e){
		throw e
  }
}