"use client"
import Image from 'next/image';
import rocketLogo from './assets/rocketchat.png'
import Bubble from './components/Bubble';
import LoadingBubble from './components/LoadingBubble';
import PromptSuggestion from './components/PromptSuggestion';

import { Message } from "ai"
import { useChat } from "@ai-sdk/react"
import { useRef, useEffect } from "react"

const Home = () => {
	const { append, isLoading, messages, input, handleInputChange, handleSubmit } = useChat()
	const chatRef = useRef<HTMLDivElement>(null);
	const noMessages = !messages || messages.length === 0;
	const handlePrompt = ( promptText ) => {
		const msg: Message = {
			id: crypto.randomUUID(),
			content: promptText,
			role: "user"
		}
		append(msg)
	}

	useEffect(() => {
		if (chatRef.current) {
			chatRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	return (
		<main>
			<Image src={rocketLogo} alt="Rocket.Chat" />
			<section className={noMessages ? '' : 'populated'}>
				{noMessages ? (
					<>
						<p className='starter-text'>
						Hi, I'm R8, Rocket.Chat's AI assistant trained on documentation and other content.
						</p>
						<br/>
						<PromptSuggestion onPromptClick={handlePrompt} />
					</>
				):(
					<>
						{messages.map((message, index) => <Bubble key={`message-${index}`} message={message}/>)}
						{isLoading && <LoadingBubble/>}
						<div ref={chatRef} />
					</>
				)}
			</section>
			<form onSubmit={handleSubmit}>
				<input className="question-box" type="text" value={input} onChange={handleInputChange} placeholder='Ask me about Rocket.Chat documents'/>
				<input type="submit"/>
			</form>
		</main>
	)
}
export default Home;
