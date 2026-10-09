import type { SourceApp } from '@shared/types'
import { Icon } from '../../../../../../components/Icon'

export function AppMark({ source, iconUrl }: { source?: SourceApp; iconUrl?: string }) {
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
