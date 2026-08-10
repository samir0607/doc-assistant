import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { condensePrompt } from "./prompts";

const CONDENSE_MODEL = "gpt-4o-mini";
const CONDENSE_HISTORY_TURNS = 6;

export type ChatMessage = { role: string; content: string };

export const buildSearchQuery = async (
	messages: readonly ChatMessage[]
): Promise<string> => {
	const question = messages[messages.length - 1]?.content ?? "";
	const history = messages.slice(0, -1).filter((m) => m.role !== "system");

	if (history.length === 0) return question;

	try {
		const { text } = await generateText({
			model: openai(CONDENSE_MODEL),
			prompt: condensePrompt(history.slice(-CONDENSE_HISTORY_TURNS), question),
			temperature: 0,
			maxTokens: 120,
		});
		const rewritten = text.trim();
		return rewritten || question;
	} catch (e) {
		console.warn("[query] condensation failed, using raw question", e);
		return question;
	}
};
