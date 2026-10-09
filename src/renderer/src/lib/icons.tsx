import type { SVGProps } from 'react'

/** Hand-drawn 20×20 stroke icons. Keeping them local avoids an icon-font dependency. */
const PATHS = {
	search: (
		<>
			<circle cx="8.75" cy="8.75" r="5.25" />
			<path d="m12.75 12.75 4 4" />
		</>
	),
	settings: (
		<>
			<path d="M3.5 6h6.25M14.25 6h2.25M3.5 14h2.25M10.25 14h6.25" />
			<circle cx="12" cy="6" r="2.25" />
			<circle cx="8" cy="14" r="2.25" />
		</>
	),
	plus: <path d="M10 4.5v11M4.5 10h11" />,
	close: <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />,
	all: (
		<>
			<rect x="3" y="3" width="5.5" height="5.5" rx="1.5" />
			<rect x="11.5" y="3" width="5.5" height="5.5" rx="1.5" />
			<rect x="3" y="11.5" width="5.5" height="5.5" rx="1.5" />
			<rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.5" />
		</>
	),
	text: <path d="M4 5h12M4 8.75h12M4 12.5h8.5M4 16h5.5" />,
	link: (
		<>
			<path d="M8.5 11.5a3.25 3.25 0 0 0 4.6 0l2.3-2.3a3.25 3.25 0 0 0-4.6-4.6l-.9.9" />
			<path d="M11.5 8.5a3.25 3.25 0 0 0-4.6 0l-2.3 2.3a3.25 3.25 0 0 0 4.6 4.6l.9-.9" />
		</>
	),
	image: (
		<>
			<rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" />
			<circle cx="7.25" cy="8" r="1.4" />
			<path d="m3 14.5 4-3.75 3 2.75 2.5-2.25 4.5 4" />
		</>
	),
	code: <path d="m7 6-4 4 4 4M13 6l4 4-4 4M11.25 4.5l-2.5 11" />,
	color: (
		<>
			<path d="M10 2.75s5.25 5.4 5.25 9a5.25 5.25 0 0 1-10.5 0c0-3.6 5.25-9 5.25-9Z" />
		</>
	),
	file: (
		<>
			<path d="M5.25 2.75h6l3.5 3.5v10.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-13.5a.5.5 0 0 1 .5-.5Z" />
			<path d="M11 2.75v3.75h3.75" />
		</>
	),
	pin: (
		<>
			<path d="M7.5 3h5l-.75 4.75 2.75 2.5v1.25h-9v-1.25l2.75-2.5L7.5 3Z" />
			<path d="M10 11.5V17" />
		</>
	),
	trash: (
		<>
			<path d="M3.75 5.5h12.5M8 5.5V3.75h4V5.5M5.5 5.5l.75 10.75h7.5l.75-10.75" />
		</>
	),
	copy: (
		<>
			<rect x="7" y="7" width="9.5" height="9.5" rx="2" />
			<path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 4 5v6a1.5 1.5 0 0 0 1.5 1.5H7" />
		</>
	),
	paste: (
		<>
			<rect x="4.5" y="4" width="11" height="13" rx="2" />
			<path d="M7.5 4V3.25h5V4M7.5 9h5M7.5 12.25h3.5" />
		</>
	),
	edit: <path d="M12.75 3.75 16.25 7.25 7.5 16H4v-3.5l8.75-8.75Z" />,
	eye: (
		<>
			<path d="M2.5 10s2.75-5.25 7.5-5.25S17.5 10 17.5 10 14.75 15.25 10 15.25 2.5 10 2.5 10Z" />
			<circle cx="10" cy="10" r="2.25" />
		</>
	),
	external: (
		<path d="M11.5 3.5h5v5M16.5 3.5 9 11M14 11.5v4a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
	),
	check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
	chevron: <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />,
	clock: (
		<>
			<circle cx="10" cy="10" r="7.25" />
			<path d="M10 6v4.25l2.75 1.75" />
		</>
	),
	tag: (
		<>
			<path d="M3 3h6.5l7.5 7.5-6.5 6.5L3 9.5V3Z" />
			<circle cx="6.5" cy="6.5" r="1.1" />
		</>
	),
	pause: <path d="M7.25 4.5v11M12.75 4.5v11" />,
	folder: (
		<path d="M2.75 5.5a1 1 0 0 1 1-1h4l1.75 2h6.75a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3.75a1 1 0 0 1-1-1v-10Z" />
	)
} as const

export type IconName = keyof typeof PATHS

export function Icon({
	name,
	size = 16,
	...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			{...rest}
		>
			{PATHS[name]}
		</svg>
	)
}
