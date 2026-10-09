import { memo } from 'react'
import type { SectionProps } from './section.types'

const Section = (props: SectionProps) => {
	const { title, children } = props

	return (
		<section className="settings-section" aria-label={title}>
			<h2>{title}</h2>
			<div className="settings-group">{children}</div>
		</section>
	)
}

export default memo(Section)
