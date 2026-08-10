"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

type CopyButtonProps = {
	getText: () => string;
	className?: string;
	label?: string;
	showLabel?: boolean;
};

const CopyButton = ({
	getText,
	className = "icon-button",
	label = "Copy",
	showLabel = true,
}: CopyButtonProps) => {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(getText());
			setCopied(true);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 1600);
		} catch {}
	}, [getText]);

	return (
		<button
			type="button"
			className={className}
			onClick={handleCopy}
			aria-label={copied ? "Copied" : label}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
			{showLabel && <span>{copied ? "Copied" : label}</span>}
		</button>
	);
};

export default CopyButton;
