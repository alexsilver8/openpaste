import { memo, useRef, type DragEvent, type MouseEvent } from 'react'
import { kindLabel } from '@shared/classify'
import { KIND_COLORS } from '@renderer/lib/colors'
import { relativeTime } from '@renderer/lib/format'
import { MOD } from '@renderer/env'
import { AppMark } from './components/app-mark'
import { Body } from './components/body'
import { meta } from './card.utils'
import type { CardProps } from './card.props'

const Card = (props: CardProps) => {
	const {
		item,
		index,
		selected,
		showHint,
		tapToPaste,
		boards,
		terms,
		now,
		onSelect,
		onActivate,
		onMenu,
		onDragStart
	} = props

	const band = item.source?.color ?? KIND_COLORS[item.kind]
	const pinned = boards.filter((b) => item.pinboards.includes(b.id))
	const label = item.title || kindLabel(item)
	const wasSelected = useRef(false)

	const handleMouseDown = () => {
		wasSelected.current = selected
		onSelect(index)
	}

	const handleClick = () => {
		if (tapToPaste && wasSelected.current) onActivate(index)
	}

	const handleDoubleClick = () => onActivate(index)

	const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => onMenu(index, e)

	const handleDragStart = (e: DragEvent<HTMLDivElement>) => onDragStart(index, e)

	return (
		<div
			id={`card-${item.id}`}
			role="option"
			aria-selected={selected}
			aria-label={`${label}, ${item.source?.name ?? 'unknown app'}, ${relativeTime(item.usedAt, now)}`}
			className={`card card--${item.kind}${selected ? ' is-selected' : ''}`}
			style={{ ['--band' as string]: band }}
			draggable
			onMouseDown={handleMouseDown}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			onContextMenu={handleContextMenu}
			onDragStart={handleDragStart}
		>
			<header className="card-band">
				<span className="card-band-text">
					<span className="card-label">{label}</span>
					<span className="card-time">{relativeTime(item.usedAt, now)}</span>
				</span>
				<AppMark source={item.source} iconUrl={item.iconUrl} />
			</header>
			<div className={`card-body card-body--${item.kind}`}>
				<Body item={item} terms={terms} />
			</div>
			<footer className="card-foot">
				<span className="card-meta">{meta(item)}</span>
				<span className="card-foot-end">
					{pinned.map((b) => (
						<span
							key={b.id}
							className="board-dot"
							style={{ background: b.color }}
							title={b.name}
						/>
					))}
					{showHint && index < 9 && (
						<kbd className="quick-key">
							{MOD}
							{index + 1}
						</kbd>
					)}
				</span>
			</footer>
		</div>
	)
}

export default memo(Card)
