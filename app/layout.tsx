import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./global.css";

const sans = Inter({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-sans-loaded",
});

const mono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500"],
	display: "swap",
	variable: "--font-mono-loaded",
});

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
		<html lang="en" className={`${sans.variable} ${mono.variable}`}>
			<body>{children}</body>
		</html>
	);
};

export default RootLayout;
