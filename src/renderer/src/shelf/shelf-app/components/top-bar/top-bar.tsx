import { memo, useState, type MouseEvent } from 'react'
import { Icon } from '@renderer/components/icon'
import { MOD } from '@renderer/env'
import { BoardTab } from './components/board-tab'
import { KindOption } from './components/kind-option'
import { KINDS } from './top-bar.constants'
import type { TopBarProps } from './top-bar.types'

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

	const handleButtonMouseDown = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault()

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
					onChange={(e) => onQuery(e.currentTarget.value)}
				/>
				{query ? (
					<button
						type="button"
						className="search-clear"
						aria-label="Clear search"
						onMouseDown={handleButtonMouseDown}
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
					onMouseDown={handleButtonMouseDown}
					onClick={() => onBoard(null)}
				>
					<Icon name="clock" size={14} />
					History
				</button>
				{boards.map((b) => (
					<BoardTab
						key={b.id}
						board={b}
						selected={board === b.id}
						isDropTarget={dropTarget === b.id}
						onBoard={onBoard}
						onEditBoard={onEditBoard}
						onDropOnBoard={onDropOnBoard}
						onDropTargetChange={setDropTarget}
					/>
				))}
				<button
					type="button"
					className="board-add"
					aria-label="New pinboard"
					title="New pinboard"
					onMouseDown={handleButtonMouseDown}
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
						<KindOption
							key={k.kind}
							kind={k.kind}
							icon={k.icon}
							label={k.label}
							checked={kind === k.kind}
							onKind={onKind}
						/>
					))}
				</div>
				<button
					type="button"
					className="icon-button"
					aria-label="Settings"
					title={`Settings (${MOD},)`}
					onMouseDown={handleButtonMouseDown}
					onClick={onSettings}
				>
					<Icon name="settings" size={17} />
				</button>
			</div>
		</div>
	)
}

export default memo(TopBar)
