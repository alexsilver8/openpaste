import type { DragEvent, MouseEvent } from 'react'
import type { ClipView, Pinboard } from '@shared/types'

export interface CardProps {
	item: ClipView
	index: number
	selected: boolean
	showHint: boolean
	/** Touch screens: tapping the already-selected card pastes it. */
	tapToPaste?: boolean
	boards: Pinboard[]
	terms: string[]
	now: number
	onSelect(index: number): void
	onActivate(index: number): void
	onMenu(index: number, event: MouseEvent): void
	onDragStart(index: number, event: DragEvent): void
}
