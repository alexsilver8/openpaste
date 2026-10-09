import { memo } from 'react'
import type { ColorSwatchProps } from './color-swatch.props'

const ColorSwatch = (props: ColorSwatchProps) => {
	const { color, selected, onSelect } = props

	const handleClick = () => onSelect(color)

	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			aria-label={color}
			className={`swatch${selected ? ' is-selected' : ''}`}
			style={{ background: color }}
			onClick={handleClick}
		/>
	)
}

export default memo(ColorSwatch)
