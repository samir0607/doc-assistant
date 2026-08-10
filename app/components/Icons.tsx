type IconProps = {
	size?: number;
	className?: string;
};

const base = (size: number) => ({
	width: size,
	height: size,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
	"aria-hidden": true,
});

export const SendIcon = ({ size = 18, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="M12 19V5" />
		<path d="m5 12 7-7 7 7" />
	</svg>
);

export const StopIcon = ({ size = 16, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
	</svg>
);

export const CopyIcon = ({ size = 14, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<rect x="9" y="9" width="11" height="11" rx="2" />
		<path d="M5 15V5a2 2 0 0 1 2-2h10" />
	</svg>
);

export const CheckIcon = ({ size = 14, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="m20 6-11 11-5-5" />
	</svg>
);

export const RefreshIcon = ({ size = 14, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="M21 12a9 9 0 1 1-3-6.7" />
		<path d="M21 3v6h-6" />
	</svg>
);

export const PlusIcon = ({ size = 15, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</svg>
);

export const ArrowDownIcon = ({ size = 14, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="M12 5v14" />
		<path d="m19 12-7 7-7-7" />
	</svg>
);

export const BookIcon = ({ size = 15, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
	</svg>
);

export const SparkIcon = ({ size = 16, className }: IconProps) => (
	<svg {...base(size)} className={className}>
		<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
	</svg>
);
