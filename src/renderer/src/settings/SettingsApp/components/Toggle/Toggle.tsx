export function Toggle({
	id,
	checked,
	onChange
}: {
	id: string
	checked: boolean
	onChange(v: boolean): void
}) {
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
