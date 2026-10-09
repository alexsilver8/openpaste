import type { Pinboard } from '@shared/types'

export interface BoardChipProps {
	board: Pinboard
	pinned: boolean
	onToggle(boardId: string, pinned: boolean): void
}
