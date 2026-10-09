import { memo } from 'react'
import type { ToggleProps } from './toggle.props'

const Toggle = ({ id, checked, onChange }: ToggleProps) => {
	return (
		<button
			id={id}
			type="button"
			role="switch"
			aria-checked={checked}
			className="toggle"
			onClick={() => onChange(!checked)}
		>
			<span className="toggle-knob" />
		</button>
	)
}

export default memo(Toggle)
