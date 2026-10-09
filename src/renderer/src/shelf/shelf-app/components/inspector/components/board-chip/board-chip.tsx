import { memo } from 'react'
import { Icon } from '@renderer/components/icon'
import type { BoardChipProps } from './board-chip.props'

const BoardChip = (props: BoardChipProps) => {
	const { board, pinned, onToggle } = props

	return (
		<button
			type="button"
			aria-pressed={pinned}
			className={`chip${pinned ? ' is-on' : ''}`}
			onClick={() => onToggle(board.id, !pinned)}
		>
			<span className="board-dot" style={{ background: board.color }} />
			{board.name}
			{pinned && <Icon name="check" size={12} />}
		</button>
	)
}

export default memo(BoardChip)
