import { memo, type DragEvent, type MouseEvent } from 'react'
import { DRAG_TYPE } from './board-tab.constants'
import type { BoardTabProps } from './board-tab.types'

const BoardTab = (props: BoardTabProps) => {
	const {
		board,
		selected,
		isDropTarget,
		onBoard,
		onEditBoard,
		onDropOnBoard,
		onDropTargetChange
	} = props

	const handleContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
		e.preventDefault()
		onEditBoard(board, e.currentTarget.getBoundingClientRect())
	}

	const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
		if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'link'
		onDropTargetChange(board.id)
	}

	const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
		e.preventDefault()
		onDropTargetChange(null)
		const id = e.dataTransfer.getData(DRAG_TYPE)
		if (id) onDropOnBoard(board.id, id)
	}

	return (
		<button
			type="button"
			role="tab"
			aria-selected={selected}
			className={`board-tab${isDropTarget ? ' is-drop' : ''}`}
			title="Double-click to rename"
			onMouseDown={(e) => e.preventDefault()}
			onClick={() => onBoard(board.id)}
			onDoubleClick={(e) => onEditBoard(board, e.currentTarget.getBoundingClientRect())}
			onContextMenu={handleContextMenu}
			onDragOver={handleDragOver}
			onDragLeave={() => onDropTargetChange(null)}
			onDrop={handleDrop}
		>
			<span className="board-dot" style={{ background: board.color }} />
			{board.name}
		</button>
	)
}

export default memo(BoardTab)
