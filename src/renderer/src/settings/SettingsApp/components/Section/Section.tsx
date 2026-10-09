import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="settings-section" aria-label={title}>
			<h2>{title}</h2>
			<div className="settings-group">{children}</div>
		</section>
	)
}
