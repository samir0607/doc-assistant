import type { Message } from "ai";

export type Source = { index: number; url: string; title: string };

export const readSources = (message: Message): Source[] => {
	const annotations = message.annotations;
	if (!Array.isArray(annotations)) return [];

	for (const annotation of annotations) {
		if (typeof annotation !== "object" || annotation === null) continue;
		const candidate = (annotation as { sources?: unknown }).sources;
		if (!Array.isArray(candidate)) continue;

		const sources = candidate.filter(
			(source): source is Source =>
				typeof source === "object" &&
				source !== null &&
				typeof (source as Source).url === "string" &&
				typeof (source as Source).index === "number"
		);
		if (sources.length > 0) return sources;
	}

	return [];
};

const Sources = ({ sources }: { sources: readonly Source[] }) => {
	const unique = [...sources].sort((a, b) => a.index - b.index);
	if (unique.length === 0) return null;

	return (
		<div className="sources">
			<span className="sources__label">Sources</span>
			<ul className="sources__list">
				{unique.map((source) => (
					<li key={source.url}>
						<a
							className="sources__chip"
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							title={source.url}
						>
							<span className="sources__index">{source.index}</span>
							<span className="sources__title">
								{source.title || source.url}
							</span>
						</a>
					</li>
				))}
			</ul>
		</div>
	);
};

export default Sources;
