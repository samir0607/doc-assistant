"use client";

import { useCallback, type ReactNode } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "ai";

import rocketLogo from "../assets/rocketchat.png";
import CodeBlock from "./CodeBlock";
import CopyButton from "./CopyButton";
import Sources, { readSources } from "./Sources";

const remarkPlugins = [remarkGfm];

const markdownComponents = {
	pre: CodeBlock,
	table: ({ children }: { children?: ReactNode }) => (
		<div className="table-scroll">
			<table>{children}</table>
		</div>
	),
	a: ({ href, children }: { href?: string; children?: ReactNode }) => (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
};

const Bubble = ({ message }: { message: Message }) => {
	const { content, role } = message;
	const isUser = role === "user";
	const getText = useCallback(() => content, [content]);
	const sources = isUser ? [] : readSources(message);

	return (
		<article
			className={`message message--${isUser ? "user" : "assistant"}`}
			aria-label={isUser ? "Your message" : "Assistant message"}
		>
			{!isUser && (
				<div className="message__avatar" aria-hidden="true">
					<Image src={rocketLogo} alt="" width={18} height={18} />
				</div>
			)}

			<div className="message__body">
				<div className={`${isUser ? "user" : "assistant"} bubble`}>
					{isUser ? (
						content
					) : (
						<ReactMarkdown
							components={markdownComponents}
							remarkPlugins={remarkPlugins}
						>
							{content}
						</ReactMarkdown>
					)}
				</div>

				{sources.length > 0 && <Sources sources={sources} />}

				{!isUser && content.length > 0 && (
					<div className="message__actions">
						<CopyButton getText={getText} />
					</div>
				)}
			</div>
		</article>
	);
};

export default Bubble;
