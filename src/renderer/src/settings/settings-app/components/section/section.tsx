import type { SectionProps } from './section.props'

export function Section({ title, children }: SectionProps) {
	return (
		<section className="settings-section" aria-label={title}>
			<h2>{title}</h2>
			<div className="settings-group">{children}</div>
		</section>
	)
}
