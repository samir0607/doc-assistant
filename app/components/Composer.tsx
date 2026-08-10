"use client";

import {
	useEffect,
	useLayoutEffect,
	useRef,
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
} from "react";
import { SendIcon, StopIcon } from "./Icons";

const MAX_HEIGHT = 200;

type ComposerProps = {
	value: string;
	onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onStop: () => void;
	isStreaming: boolean;
};

const Composer = ({
	value,
	onChange,
	onSubmit,
	onStop,
	isStreaming,
}: ComposerProps) => {
	const formRef = useRef<HTMLFormElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const composingRef = useRef(false);

	useLayoutEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
	}, [value]);

	useEffect(() => {
		if (!isStreaming) textareaRef.current?.focus();
	}, [isStreaming]);

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== "Enter" || event.shiftKey || composingRef.current) return;
		event.preventDefault();
		if (isStreaming || !value.trim()) return;
		formRef.current?.requestSubmit();
	};

	const canSend = value.trim().length > 0 && !isStreaming;

	return (
		<form ref={formRef} className="composer" onSubmit={onSubmit}>
			<label htmlFor="composer-input" className="visually-hidden">
				Ask about Rocket.Chat
			</label>
			<textarea
				id="composer-input"
				ref={textareaRef}
				className="composer__input"
				value={value}
				onChange={onChange}
				onKeyDown={handleKeyDown}
				onCompositionStart={() => {
					composingRef.current = true;
				}}
				onCompositionEnd={() => {
					composingRef.current = false;
				}}
				rows={1}
				placeholder="Ask anything about Rocket.Chat…"
				autoFocus
			/>

			{isStreaming ? (
				<button
					type="button"
					className="composer__send composer__send--stop"
					onClick={onStop}
					aria-label="Stop generating"
				>
					<StopIcon />
				</button>
			) : (
				<button
					type="submit"
					className="composer__send"
					disabled={!canSend}
					aria-label="Send message"
				>
					<SendIcon />
				</button>
			)}
		</form>
	);
};

export default Composer;
