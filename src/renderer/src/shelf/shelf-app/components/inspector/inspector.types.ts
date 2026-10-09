import type { ClipView, Pinboard } from '@shared/types'

export interface InspectorProps {
	item: ClipView
	boards: Pinboard[]
	startEditing?: boolean
	focusTitle?: boolean
	onClose(): void
	onPaste(plain: boolean): void
	onCopy(): void
	onDelete(): void
}
