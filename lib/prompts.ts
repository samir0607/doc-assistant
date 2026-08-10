import {
	citationNumbers,
	toSources,
	type RetrievedChunk,
	type Source,
} from "./retrieval";

export const renderContext = (
	chunks: readonly RetrievedChunk[],
	sources: readonly Source[] = toSources(chunks)
): string => {
	const numberOf = citationNumbers(sources);

	return chunks
		.map((chunk) =>
			[
				`[${numberOf.get(chunk.url) ?? 0}] ${chunk.section || chunk.title}`,
				`Source: ${chunk.url}`,
				"",
				chunk.body,
			].join("\n")
		)
		.join("\n\n---\n\n");
};

export const systemPrompt = (
	chunks: readonly RetrievedChunk[],
	sources: readonly Source[] = toSources(chunks)
): string => {
	if (chunks.length === 0) {
		return `You are R8, an AI assistant for Rocket.Chat documentation.

No relevant documentation was found for this question. Tell the user you don't have documentation covering it and suggest they check https://docs.rocket.chat/ directly. Do not answer from prior knowledge.`;
	}

	return `You are R8, an AI assistant that answers questions about Rocket.Chat using its official documentation.

Rules:
- Answer using ONLY the numbered context below. If it does not contain the answer, say so plainly rather than falling back on prior knowledge.
- Cite the context blocks you used inline, as [1] or [2][3], placed at the end of the sentence they support. Cite only numbers that appear in the context.
- Format in markdown. Use fenced code blocks with a language tag for commands and configuration.
- Be direct. Prefer a short ordered list of steps over prose when describing a procedure.
- Do not return images.

--- START CONTEXT ---
${renderContext(chunks, sources)}
--- END CONTEXT ---`;
};

export const condensePrompt = (
	history: readonly { role: string; content: string }[],
	question: string
): string => {
	const transcript = history
		.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
		.join("\n");

	return `Rewrite the follow-up question as a standalone question about Rocket.Chat that can be understood without the conversation.

Keep the user's original wording and intent wherever possible. Resolve pronouns and elliptical references ("it", "that", "how about on AWS?") using the conversation. Output only the rewritten question, with no preamble.

Conversation:
${transcript}

Follow-up question: ${question}

Standalone question:`;
};
