import { memo } from 'react'
import type { ColorSwatchProps } from './color-swatch.props'

const ColorSwatch = (props: ColorSwatchProps) => {
	const { color, selected, onSelect } = props

	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			aria-label={color}
			className={`swatch${selected ? ' is-selected' : ''}`}
			style={{ background: color }}
			onClick={() => onSelect(color)}
		/>
	)
}

export default memo(ColorSwatch)
