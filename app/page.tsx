"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { Message } from "ai";

import rocketLogo from "./assets/rocketchat.png";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import Composer from "./components/Composer";
import PromptSuggestion from "./components/PromptSuggestion";
import {
	ArrowDownIcon,
	BookIcon,
	PlusIcon,
	RefreshIcon,
} from "./components/Icons";
import { DOCS_HOME } from "@/lib/sources";

const PIN_THRESHOLD = 80;

const Home = () => {
	const {
		append,
		isLoading,
		messages,
		setMessages,
		input,
		handleInputChange,
		handleSubmit,
		reload,
		stop,
		error,
	} = useChat();

	const scrollRef = useRef<HTMLDivElement>(null);
	const [pinned, setPinned] = useState(true);

	const noMessages = messages.length === 0;
	const awaitingFirstToken =
		isLoading && messages[messages.length - 1]?.role !== "assistant";

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior });
	}, []);

	useEffect(() => {
		if (pinned) scrollToBottom(noMessages ? "auto" : "smooth");
	}, [messages, isLoading, pinned, noMessages, scrollToBottom]);

	const handleScroll = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
		setPinned(distance < PIN_THRESHOLD);
	}, []);

	const handlePrompt = useCallback(
		(promptText: string) => {
			const msg: Message = {
				id: crypto.randomUUID(),
				content: promptText,
				role: "user",
			};
			setPinned(true);
			append(msg);
		},
		[append]
	);

	const handleNewChat = useCallback(() => {
		stop();
		setMessages([]);
		setPinned(true);
	}, [stop, setMessages]);

	return (
		<div className="app">
			<header className="app-header">
				<div className="app-header__brand">
					<Image
						className="app-header__logo"
						src={rocketLogo}
						alt="Rocket.Chat"
						width={30}
						height={30}
						priority
					/>
					<div className="app-header__titles">
						<h1 className="app-header__title">R8 · Docs Assistant</h1>
						<p className="app-header__subtitle">
							Grounded in the Rocket.Chat documentation
						</p>
					</div>
				</div>

				<div className="app-header__spacer" />

				<div className="app-header__actions">
					<a
						className="ghost-button"
						href={DOCS_HOME}
						target="_blank"
						rel="noopener noreferrer"
					>
						<BookIcon />
						<span>Official docs</span>
					</a>

					<button
						type="button"
						className="ghost-button"
						onClick={handleNewChat}
						disabled={noMessages}
					>
						<PlusIcon />
						<span>New chat</span>
					</button>
				</div>
			</header>

			<div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
				<div className={`chat-inner${noMessages ? " chat-inner--centered" : ""}`}>
					{noMessages ? (
						<div className="empty-state">
							<Image
								className="empty-state__logo"
								src={rocketLogo}
								alt=""
								width={56}
								height={56}
								priority
							/>
							<h2 className="empty-state__title">
								Hi, I&apos;m R8, ask me about Rocket.Chat
							</h2>
							<p className="empty-state__subtitle">
								I answer from the official Rocket.Chat documentation, so you get
								sourced guidance on deploying, configuring, and developing on
								the platform.
							</p>
							<PromptSuggestion onPromptClick={handlePrompt} />
						</div>
					) : (
						<div role="log" aria-live="polite" aria-label="Conversation">
							{messages.map((message) => (
								<Bubble key={message.id} message={message} />
							))}
							{awaitingFirstToken && <LoadingBubble />}
						</div>
					)}

					{error && (
						<div className="error-banner" role="alert">
							<span className="error-banner__text">
								Something went wrong while answering. Check your connection and
								try again.
							</span>
							<button
								type="button"
								className="ghost-button"
								onClick={() => reload()}
							>
								<RefreshIcon />
								<span>Retry</span>
							</button>
						</div>
					)}
				</div>
			</div>

			<div className="composer-wrap">
				{!pinned && !noMessages && (
					<button
						type="button"
						className="scroll-bottom"
						onClick={() => {
							setPinned(true);
							scrollToBottom();
						}}
					>
						<ArrowDownIcon />
						<span>Jump to latest</span>
					</button>
				)}

				<div className="composer-inner">
					<Composer
						value={input}
						onChange={handleInputChange}
						onSubmit={(event) => {
							setPinned(true);
							handleSubmit(event);
						}}
						onStop={stop}
						isStreaming={isLoading}
					/>
					<p className="composer__footnote">
						R8 can make mistakes. Verify important details against the{" "}
						<a
							className="composer__footnote-link"
							href={DOCS_HOME}
							target="_blank"
							rel="noopener noreferrer"
						>
							official Rocket.Chat docs
						</a>
						.
					</p>
				</div>
			</div>
		</div>
	);
};

export default Home;
