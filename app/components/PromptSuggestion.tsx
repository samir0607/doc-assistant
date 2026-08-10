import PromptSuggestionButton from "./PromptSuggestionButton";

const prompts = [
	{
		title: "Set up a dev environment",
		hint: "Local setup, prerequisites, and first run",
	},
	{
		title: "Deploy Rocket.Chat",
		hint: "Docker, Kubernetes, AWS, and Snaps",
	},
	{
		title: "Configure Rocket.Chat",
		hint: "Admin settings, environment variables, SSL",
	},
	{
		title: "What is Rocket.Chat?",
		hint: "A quick overview of the platform and plans",
	},
];

const PromptSuggestion = ({
	onPromptClick,
}: {
	onPromptClick: (prompt: string) => void;
}) => {
	return (
		<div className="prompt-suggestion">
			{prompts.map((prompt) => (
				<PromptSuggestionButton
					key={prompt.title}
					title={prompt.title}
					hint={prompt.hint}
					onClick={() => onPromptClick(prompt.title)}
				/>
			))}
		</div>
	);
};

export default PromptSuggestion;
