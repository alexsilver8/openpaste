import type { Pinboard } from '@shared/types'

export interface BoardTabProps {
	board: Pinboard
	selected: boolean
	isDropTarget: boolean
	onBoard(id: string): void
	onEditBoard(board: Pinboard, anchor: DOMRect): void
	onDropOnBoard(boardId: string, itemId: string): void
	onDropTargetChange(boardId: string | null): void
}
