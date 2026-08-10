type PromptSuggestionButtonProps = {
	title: string;
	hint?: string;
	onClick: () => void;
};

const PromptSuggestionButton = ({
	title,
	hint,
	onClick,
}: PromptSuggestionButtonProps) => {
	return (
		<button type="button" className="prompt-suggestion-button" onClick={onClick}>
			<span className="prompt-suggestion-button__title">{title}</span>
			{hint && <span className="prompt-suggestion-button__hint">{hint}</span>}
		</button>
	);
};

export default PromptSuggestionButton;
