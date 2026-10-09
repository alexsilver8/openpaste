import { memo, useState } from 'react'
import { Icon } from '@renderer/components/icon'
import { MOD } from '@renderer/env'
import { DRAG_TYPE, KINDS } from './top-bar.constants'
import type { TopBarProps } from './top-bar.props'

const TopBar = (props: TopBarProps) => {
	const {
		boards,
		board,
		kind,
		inputRef,
		query,
		onQuery,
		onBoard,
		onEditBoard,
		onDropOnBoard,
		onNewBoard,
		paused,
		onResume,
		onKind,
		onSettings
	} = props

	const [dropTarget, setDropTarget] = useState<string | null>(null)

	return (
		<div className="topbar">
			<label className="search">
				<Icon name="search" size={16} />
				<input
					ref={inputRef}
					type="text"
					aria-label="Search clipboard history"
					placeholder="Search"
					spellCheck={false}
					autoComplete="off"
					value={query}
					onChange={(e) => onQuery(e.target.value)}
				/>
				{query ? (
					<button
						type="button"
						className="search-clear"
						aria-label="Clear search"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onQuery('')}
					>
						<Icon name="close" size={13} />
					</button>
				) : (
					<kbd className="search-hint">{MOD}F</kbd>
				)}
			</label>

			<nav className="boards" role="tablist" aria-label="Pinboards">
				<button
					type="button"
					role="tab"
					aria-selected={board === null}
					className="board-tab"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => onBoard(null)}
				>
					<Icon name="clock" size={14} />
					History
				</button>
				{boards.map((b) => (
					<button
						key={b.id}
						type="button"
						role="tab"
						aria-selected={board === b.id}
						className={`board-tab${dropTarget === b.id ? ' is-drop' : ''}`}
						title="Double-click to rename"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onBoard(b.id)}
						onDoubleClick={(e) =>
							onEditBoard(b, e.currentTarget.getBoundingClientRect())
						}
						onContextMenu={(e) => {
							e.preventDefault()
							onEditBoard(b, e.currentTarget.getBoundingClientRect())
						}}
						onDragOver={(e) => {
							if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
							e.preventDefault()
							e.dataTransfer.dropEffect = 'link'
							setDropTarget(b.id)
						}}
						onDragLeave={() => setDropTarget(null)}
						onDrop={(e) => {
							e.preventDefault()
							setDropTarget(null)
							const id = e.dataTransfer.getData(DRAG_TYPE)
							if (id) onDropOnBoard(b.id, id)
						}}
					>
						<span className="board-dot" style={{ background: b.color }} />
						{b.name}
					</button>
				))}
				<button
					type="button"
					className="board-add"
					aria-label="New pinboard"
					title="New pinboard"
					onMouseDown={(e) => e.preventDefault()}
					onClick={(e) => onNewBoard(e.currentTarget.getBoundingClientRect())}
				>
					<Icon name="plus" size={15} />
				</button>
			</nav>

			<div className="topbar-end">
				{paused && (
					<button
						type="button"
						className="paused"
						onClick={onResume}
						title="Resume capturing"
					>
						<Icon name="pause" size={13} />
						Capturing paused
					</button>
				)}
				<div className="kinds" role="radiogroup" aria-label="Filter by type">
					{KINDS.map((k) => (
						<button
							key={k.kind}
							type="button"
							role="radio"
							aria-checked={kind === k.kind}
							aria-label={k.label}
							title={k.label}
							className="kind"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => onKind(k.kind)}
						>
							<Icon name={k.icon} size={15} />
						</button>
					))}
				</div>
				<button
					type="button"
					className="icon-button"
					aria-label="Settings"
					title={`Settings (${MOD},)`}
					onMouseDown={(e) => e.preventDefault()}
					onClick={onSettings}
				>
					<Icon name="settings" size={17} />
				</button>
			</div>
		</div>
	)
}

export default memo(TopBar)
