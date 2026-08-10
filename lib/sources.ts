import docUrls from "./doc-urls.json";

const EXCLUDE: RegExp[] = [/\/tags(\/|\.md$)/];

export const DOC_URLS: readonly string[] = (docUrls as string[]).filter(
	(url) => !EXCLUDE.some((pattern) => pattern.test(url))
);
