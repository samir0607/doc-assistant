import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./global.css";

export const metadata: Metadata = {
	title: "R8 · Rocket.Chat Docs Assistant",
	description:
		"Ask questions about deploying, configuring, and developing on Rocket.Chat, answered from the official documentation.",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fef8ec" },
		{ media: "(prefers-color-scheme: dark)", color: "#052529" },
	],
};

const RootLayout = ({ children }: { children: ReactNode }) => {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
};

export default RootLayout;
