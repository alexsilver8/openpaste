import { memo } from 'react'
import { Icon } from '@renderer/components/icon'
import type { IgnoredAppProps } from './ignored-app.types'

const IgnoredApp = (props: IgnoredAppProps) => {
	const { app, onRemove } = props

	return (
		<li className="chip is-on">
			{app}
			<button type="button" aria-label={`Stop ignoring ${app}`} onClick={() => onRemove(app)}>
				<Icon name="close" size={11} />
			</button>
		</li>
	)
}

export default memo(IgnoredApp)
