import { memo } from 'react'
import { PATHS } from './icon.constants'
import type { IconProps } from './icon.props'

const Icon = ({ name, size = 16, ...rest }: IconProps) => {
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

export default memo(Icon)
