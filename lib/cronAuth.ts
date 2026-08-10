import { timingSafeEqual } from "node:crypto";

export const bearerToken = (header: string | null): string | null => {
	if (!header) return null;
	const match = /^Bearer[ \t]+(\S.*)$/i.exec(header.trim());
	return match ? match[1].trim() : null;
};

export const secretsMatch = (a: string, b: string): boolean => {
	const left = Buffer.from(a, "utf8");
	const right = Buffer.from(b, "utf8");
	// timingSafeEqual throws on length mismatch, and the length itself is not
	// worth hiding here.
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
};

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * configured. With no secret set the endpoint stays open, which keeps local
 * development and a first deploy working; set CRON_SECRET to close it.
 */
export const isCronAuthorised = (
	req: Request,
	secret = process.env.CRON_SECRET
): boolean => {
	if (!secret) return true;
	const token = bearerToken(req.headers.get("authorization"));
	return token !== null && secretsMatch(token, secret);
};
