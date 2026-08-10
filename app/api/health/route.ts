import { isCronAuthorised } from "@/lib/cronAuth";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { getCollection } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 15;
// A cached response would return 200 without touching Astra, which defeats the
// entire point of the endpoint.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

const NO_STORE = { "cache-control": "no-store, max-age=0" };

export async function GET(req: Request) {
	if (!isCronAuthorised(req)) {
		return Response.json(
			{ status: "unauthorised" },
			{ status: 401, headers: NO_STORE }
		);
	}

	// Namespaced so keep-alive pings do not spend the chat endpoint's budget for
	// the same IP — both limiters share one in-process store.
	const limit = rateLimit({
		key: `health:${clientKey(req)}`,
		limit: RATE_LIMIT,
		windowMs: RATE_WINDOW_MS,
	});

	if (!limit.ok) {
		return Response.json(
			{ status: "throttled" },
			{
				status: 429,
				headers: { ...NO_STORE, "retry-after": String(limit.retryAfter) },
			}
		);
	}

	const startedAt = Date.now();

	try {
		// A real read, not just client construction: this is what keeps a
		// serverless Astra database from hibernating, and it proves the
		// collection exists and has content.
		const doc = await getCollection().findOne({}, { projection: { _id: 1 } });

		return Response.json(
			{
				status: "ok",
				database: "reachable",
				populated: doc !== null,
				latencyMs: Date.now() - startedAt,
			},
			{ headers: NO_STORE }
		);
	} catch (e) {
		console.error("[api/health] astra check failed:", e);
		return Response.json(
			{
				status: "error",
				database: "unreachable",
				latencyMs: Date.now() - startedAt,
			},
			{ status: 503, headers: NO_STORE }
		);
	}
}
