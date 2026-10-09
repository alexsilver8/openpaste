import { memo } from 'react'
import type { ThemeOptionProps } from './theme-option.props'

const ThemeOption = (props: ThemeOptionProps) => {
	const { value, label, checked, onSelect } = props

	const handleClick = () => onSelect(value)

	return (
		<button type="button" role="radio" aria-checked={checked} onClick={handleClick}>
			{label}
		</button>
	)
}

export default memo(ThemeOption)
