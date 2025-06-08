import ReactMarkdown from 'react-markdown'

const Bubble = ({ message }) => {
	const { content, role } = message;
	
	return (
		<div className={`${role} bubble`}>
			{role === 'assistant' ? (
				<ReactMarkdown>{content}</ReactMarkdown>
			) : (
				content
			)}
		</div>
	)
}

export default Bubble;