import "./global.css"
export const metadata = {
	title: "Doc Assistant",
	description: "A documentation assistant for developers",
}

const RootLayout = ({ children }) => {
	return (
		<html lang="en">
			<body>{ children }</body>
		</html>
	)
}
export default RootLayout;