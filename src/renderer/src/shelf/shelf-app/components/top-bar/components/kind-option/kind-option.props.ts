import type { ClipKind } from '@shared/types'
import type { IconName } from '@renderer/components/icon'

export interface KindOptionProps {
	kind: ClipKind | 'all'
	icon: IconName
	label: string
	checked: boolean
	onKind(kind: ClipKind | 'all'): void
}
