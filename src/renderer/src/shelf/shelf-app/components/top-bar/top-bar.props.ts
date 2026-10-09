import type { RefObject } from 'react'
import type { ClipKind, Pinboard } from '@shared/types'

export interface TopBarProps {
	inputRef: RefObject<HTMLInputElement | null>
	query: string
	onQuery(value: string): void
	boards: Pinboard[]
	board: string | null
	onBoard(id: string | null): void
	kind: ClipKind | 'all'
	onKind(kind: ClipKind | 'all'): void
	paused: boolean
	onResume(): void
	onNewBoard(anchor: DOMRect): void
	onEditBoard(board: Pinboard, anchor: DOMRect): void
	onDropOnBoard(boardId: string, itemId: string): void
	onSettings(): void
}
