import PromptSuggestionsButton from "./PromptSuggestionButton";

const PromptSuggestion = ({ onPromptClick }) => {
	const prompts = [
		"How to set up development environment for Rocket.Chat Server?",
		"What are the prerequisites to deploy Rocket.Chat Server?",
		"What are the ways to deploy Rocket.Chat Server?",
		"Brief me about Rocket.Chat Server architecture",
	]
	return (
		<div className="prompt-suggestion">
			{prompts.map((prompt, index) => 
				<PromptSuggestionsButton 
					key={`sugesstion-${index}`} 
					text={prompt} 
					onClick={() => onPromptClick(prompt)}
				/>
			)}
		</div>
	)
}

export default PromptSuggestion;