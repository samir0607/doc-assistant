import PromptSuggestionsButton from "./PromptSuggestionButton";

const PromptSuggestion = ({ onPromptClick }) => {
	const prompts = [
		"Set up development environment for Rocket.Chat",
		"Prerequisites to deploy Rocket.Chat",
		"Configure Rocket.Chat",
		"Brief me about Rocket.Chat",
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