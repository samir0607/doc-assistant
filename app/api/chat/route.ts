import { openai } from "@ai-sdk/openai";
import { createDataStreamResponse, streamText } from "ai";

import { clientKey, rateLimit } from "@/lib/rateLimit";
import { retrieve, toSources } from "@/lib/retrieval";
import { buildSearchQuery } from "@/lib/query";
import { systemPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const CHAT_MODEL = "gpt-4o-mini";
const HISTORY_LIMIT = 12;

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const ROLES = ["user", "assistant", "system"] as const;

type ChatMessage = { role: (typeof ROLES)[number]; content: string };

const isChatMessage = (value: unknown): value is ChatMessage => {
	if (typeof value !== "object" || value === null) return false;
	const { role, content } = value as Record<string, unknown>;
	return (
		typeof content === "string" &&
		ROLES.includes(role as (typeof ROLES)[number])
	);
};

export async function POST(req: Request) {
	const limit = rateLimit({
		key: clientKey(req),
		limit: RATE_LIMIT,
		windowMs: RATE_WINDOW_MS,
	});

	if (!limit.ok) {
		return Response.json(
			{ error: "Too many requests. Give it a moment and try again." },
			{ status: 429, headers: { "retry-after": String(limit.retryAfter) } }
		);
	}

	try {
		const body = await req.json();
		const messages: unknown = body?.messages;

		if (!Array.isArray(messages) || !messages.every(isChatMessage)) {
			return Response.json(
				{ error: "Expected a non-empty `messages` array." },
				{ status: 400 }
			);
		}

		const latest = messages[messages.length - 1];
		if (!latest || !latest.content.trim()) {
			return Response.json({ error: "Empty message." }, { status: 400 });
		}

		const query = await buildSearchQuery(messages);
		const chunks = await retrieve(query);
		const sources = toSources(chunks);

		return createDataStreamResponse({
			execute: (dataStream) => {
				dataStream.writeMessageAnnotation({ sources });

				const result = streamText({
					model: openai(CHAT_MODEL),
					messages: [
						{ role: "system", content: systemPrompt(chunks, sources) },
						...messages.slice(-HISTORY_LIMIT),
					],
				});

				result.mergeIntoDataStream(dataStream);
			},
			onError: (error) => {
				console.error("[api/chat] stream failed:", error);
				return "Failed to generate a response.";
			},
		});
	} catch (e) {
		console.error("[api/chat] request failed:", e);
		return Response.json(
			{ error: "Failed to generate a response." },
			{ status: 500 }
		);
	}
}
