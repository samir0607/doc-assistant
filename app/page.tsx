"use client"
import Image from 'next/image';
import rocketLogo from './assets/rocketchat.png'
import Bubble from './components/Bubble';
import LoadingBubble from './components/LoadingBubble';
import PromptSuggestion from './components/PromptSuggestion';

import { Message } from "ai"
import { useChat } from "ai/react"

const Home = () => {
	const { append, isLoading, messages, input, handleInputChange, handleSubmit } = useChat()
	const noMessages = false;
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
						<PromptSuggestion />
					</>
				):(
					<>
						{messages.map((message, index) => <Bubble key={`message-${index}`} message={message}/>)}
						{isLoading && <LoadingBubble/>}
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
