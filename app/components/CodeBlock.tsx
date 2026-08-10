"use client";

import { useCallback, useRef, type ReactNode } from "react";
import CopyButton from "./CopyButton";

const CodeBlock = ({ children }: { children?: ReactNode }) => {
	const preRef = useRef<HTMLPreElement>(null);
	const getText = useCallback(() => preRef.current?.textContent ?? "", []);

	return (
		<div className="code-block">
			<CopyButton className="code-block__copy" getText={getText} />
			<pre ref={preRef}>{children}</pre>
		</div>
	);
};

export default CodeBlock;
