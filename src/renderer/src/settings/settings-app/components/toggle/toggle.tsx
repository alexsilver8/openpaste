import { memo } from 'react'
import type { ToggleProps } from './toggle.props'

const Toggle = (props: ToggleProps) => {
	const { id, checked, onChange } = props

	const handleClick = () => onChange(!checked)

	return (
		<button
			id={id}
			type="button"
			role="switch"
			aria-checked={checked}
			className="toggle"
			onClick={handleClick}
		>
			<span className="toggle-knob" />
		</button>
	)
}

export default memo(Toggle)
