import Image from "next/image";
import rocketLogo from "../assets/rocketchat.png";

const LoadingBubble = () => {
	return (
		<div className="message message--assistant" role="status">
			<div className="message__avatar" aria-hidden="true">
				<Image src={rocketLogo} alt="" width={18} height={18} />
			</div>
			<div className="message__body">
				<div className="typing" aria-hidden="true">
					<span />
					<span />
					<span />
				</div>
				<span className="visually-hidden">Assistant is typing…</span>
			</div>
		</div>
	);
};

export default LoadingBubble;
