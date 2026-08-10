export type RateLimitResult = {
	ok: boolean;
	remaining: number;
	retryAfter: number;
};

export type RateLimitOptions = {
	key: string;
	limit: number;
	windowMs: number;
	now?: number;
	store?: Map<string, number[]>;
};

const defaultStore = new Map<string, number[]>();

const MAX_TRACKED_KEYS = 10_000;

export const rateLimit = ({
	key,
	limit,
	windowMs,
	now = Date.now(),
	store = defaultStore,
}: RateLimitOptions): RateLimitResult => {
	const cutoff = now - windowMs;
	const hits = (store.get(key) ?? []).filter((stamp) => stamp > cutoff);

	if (hits.length >= limit) {
		const oldest = hits[0];
		store.set(key, hits);
		return {
			ok: false,
			remaining: 0,
			retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
		};
	}

	hits.push(now);
	store.set(key, hits);

	if (store.size > MAX_TRACKED_KEYS) {
		for (const [tracked, stamps] of store) {
			if (stamps.every((stamp) => stamp <= cutoff)) store.delete(tracked);
		}
	}

	return { ok: true, remaining: limit - hits.length, retryAfter: 0 };
};

export const clientKey = (req: Request): string => {
	const forwarded = req.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	return req.headers.get("x-real-ip") ?? "unknown";
};
