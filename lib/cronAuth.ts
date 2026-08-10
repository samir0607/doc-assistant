import { timingSafeEqual } from "node:crypto";

export const bearerToken = (header: string | null): string | null => {
	if (!header) return null;
	const match = /^Bearer[ \t]+(\S.*)$/i.exec(header.trim());
	return match ? match[1].trim() : null;
};

export const secretsMatch = (a: string, b: string): boolean => {
	const left = Buffer.from(a, "utf8");
	const right = Buffer.from(b, "utf8");
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
};

export const isCronAuthorised = (
	req: Request,
	secret = process.env.CRON_SECRET
): boolean => {
	if (!secret) return true;
	const token = bearerToken(req.headers.get("authorization"));
	return token !== null && secretsMatch(token, secret);
};
