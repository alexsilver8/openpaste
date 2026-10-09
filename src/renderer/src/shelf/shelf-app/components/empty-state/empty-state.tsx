import { memo } from 'react'
import { formatAccelerator } from '@shared/accelerator'
import { MOD } from '@renderer/env'
import { platform } from '@renderer/env'
import type { EmptyStateProps } from './empty-state.types'

const EmptyState = (props: EmptyStateProps) => {
	const { reason, query, shortcut, boardName } = props

	let title: string
	let hint: string
	switch (reason) {
		case 'search':
			title = `Nothing matches “${query}”`
			hint = 'Narrow by type or app with is:image, is:link or app:slack.'
			break
		case 'board':
			title = `${boardName ?? 'This pinboard'} is empty`
			hint = `Drag a card onto the pinboard’s tab, or select one and press ${MOD}P.`
			break
		case 'kind':
			title = 'Nothing of this type yet'
			hint = 'Choose “All” to see your whole history.'
			break
		default:
			title = 'Copy something and it shows up here'
			hint = `Open this shelf from any app with ${formatAccelerator(shortcut, platform)}.`
	}

	return (
		<div className="empty" role="status">
			<p className="empty-title">{title}</p>
			<p className="empty-hint">{hint}</p>
		</div>
	)
}

export default memo(EmptyState)
