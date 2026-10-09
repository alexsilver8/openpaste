import type { ToggleProps } from './toggle.props'

export function Toggle({ id, checked, onChange }: ToggleProps) {
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
