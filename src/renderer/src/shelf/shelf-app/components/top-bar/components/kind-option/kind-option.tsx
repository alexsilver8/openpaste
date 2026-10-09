import { memo, type MouseEvent } from 'react'
import { Icon } from '@renderer/components/icon'
import type { KindOptionProps } from './kind-option.props'

const KindOption = (props: KindOptionProps) => {
	const { kind, icon, label, checked, onKind } = props

	const handleMouseDown = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault()

	const handleClick = () => onKind(kind)

	return (
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={label}
			title={label}
			className="kind"
			onMouseDown={handleMouseDown}
			onClick={handleClick}
		>
			<Icon name={icon} size={15} />
		</button>
	)
}

export default memo(KindOption)
