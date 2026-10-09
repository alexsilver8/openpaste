import type { Pinboard } from '@shared/types'

export interface BoardEditorProps {
	anchor: DOMRect
	board?: Pinboard
	onSave(input: { name: string; color: string }): void
	onDelete?(): void
	onClose(): void
}
