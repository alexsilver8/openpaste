import {
	memo,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type SubmitEvent
} from 'react'
import { createPortal } from 'react-dom'
import { ColorSwatch } from './components/color-swatch'
import { BOARD_COLORS } from './board-editor.constants'
import type { BoardEditorProps } from './board-editor.props'

/** Popover for creating, renaming, recoloring and deleting a pinboard. */
const BoardEditor = (props: BoardEditorProps) => {
	const { anchor, board, onSave, onDelete, onClose } = props

	const [name, setName] = useState(board?.name ?? '')
	const [color, setColor] = useState(board?.color ?? BOARD_COLORS[0])
	const [confirmDelete, setConfirmDelete] = useState(false)
	const ref = useRef<HTMLFormElement>(null)
	const [left, setLeft] = useState(anchor.left)

	useLayoutEffect(() => {
		const width = ref.current?.offsetWidth ?? 280
		setLeft(Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)))
	}, [anchor.left])

	useEffect(() => {
		const onDown = (e: MouseEvent): void => {
			if (!ref.current?.contains(e.target as Node)) onClose()
		}
		const onKey = (e: globalThis.KeyboardEvent): void => {
			if (e.key === 'Escape') {
				e.preventDefault()
				e.stopPropagation()
				onClose()
			}
		}
		window.addEventListener('mousedown', onDown, true)
		window.addEventListener('keydown', onKey, true)

		return () => {
			window.removeEventListener('mousedown', onDown, true)
			window.removeEventListener('keydown', onKey, true)
		}
	}, [onClose])

	const save = (): void => {
		if (!name.trim()) return
		onSave({ name: name.trim(), color })
	}

	const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault()
		save()
	}

	const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			save()
		}
	}

	return createPortal(
		<form
			ref={ref}
			className="popover board-editor"
			style={{ left, top: anchor.bottom + 8 }}
			onSubmit={handleSubmit}
			onKeyDown={(e) => e.stopPropagation()}
			aria-label={board ? `Edit ${board.name}` : 'New pinboard'}
		>
			<input
				autoFocus
				className="text-input"
				placeholder="Pinboard name"
				maxLength={40}
				value={name}
				onChange={(e) => setName(e.currentTarget.value)}
				onKeyDown={handleNameKeyDown}
			/>
			<div className="swatches" role="radiogroup" aria-label="Color">
				{BOARD_COLORS.map((c) => (
					<ColorSwatch key={c} color={c} selected={c === color} onSelect={setColor} />
				))}
			</div>
			<div className="popover-actions">
				{board && onDelete && (
					<button
						type="button"
						className={`button button--quiet${confirmDelete ? ' button--danger' : ''}`}
						onClick={() => (confirmDelete ? onDelete?.() : setConfirmDelete(true))}
					>
						{confirmDelete ? 'Delete pinboard' : 'Delete…'}
					</button>
				)}
				<span className="spacer" />
				<button type="button" className="button button--quiet" onClick={onClose}>
					Cancel
				</button>
				<button type="submit" className="button button--primary" disabled={!name.trim()}>
					{board ? 'Save' : 'Create pinboard'}
				</button>
			</div>
			{confirmDelete && (
				<p className="popover-note">
					Items stay in your history; only this pinboard goes away.
				</p>
			)}
		</form>,
		document.body
	)
}

export default memo(BoardEditor)
