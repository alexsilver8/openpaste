import { memo } from 'react'
import { Icon } from '@renderer/components/icon'
import type { AppMarkProps } from './app-mark.types'

const AppMark = (props: AppMarkProps) => {
	const { source, iconUrl } = props

	if (iconUrl)
		return (
			<img className="app-mark" src={iconUrl} alt="" title={source?.name} draggable={false} />
		)
	const letter = source?.name.trim().charAt(0).toUpperCase()

	return (
		<span className="app-mark app-mark--letter" title={source?.name}>
			{letter || <Icon name="paste" size={15} />}
		</span>
	)
}

export default memo(AppMark)
