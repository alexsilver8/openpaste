import { memo, useRef, type DragEvent, type MouseEvent } from 'react'
import { kindLabel } from '@shared/classify'
import type { ClipView, Pinboard } from '@shared/types'
import { KIND_COLORS } from '../../../../lib/colors'
import { relativeTime } from '../../../../lib/format'
import { MOD } from '../../../../env'
import { AppMark } from './components/AppMark'
import { Body } from './components/Body'
import { meta } from './Card.utils'

interface CardProps {
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

export const Card = memo(function Card({
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
}: CardProps) {
	const band = item.source?.color ?? KIND_COLORS[item.kind]
	const pinned = boards.filter((b) => item.pinboards.includes(b.id))
	const label = item.title || kindLabel(item)
	const wasSelected = useRef(false)
	return (
		<div
			id={`card-${item.id}`}
			role="option"
			aria-selected={selected}
			aria-label={`${label}, ${item.source?.name ?? 'unknown app'}, ${relativeTime(item.usedAt, now)}`}
			className={`card card--${item.kind}${selected ? ' is-selected' : ''}`}
			style={{ ['--band' as string]: band }}
			draggable
			onMouseDown={() => {
				wasSelected.current = selected
				onSelect(index)
			}}
			onClick={() => {
				if (tapToPaste && wasSelected.current) onActivate(index)
			}}
			onDoubleClick={() => onActivate(index)}
			onContextMenu={(e) => onMenu(index, e)}
			onDragStart={(e) => onDragStart(index, e)}
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
})
