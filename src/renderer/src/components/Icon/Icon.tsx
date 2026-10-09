import type { SVGProps } from 'react'
import { PATHS } from './Icon.constants'

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
