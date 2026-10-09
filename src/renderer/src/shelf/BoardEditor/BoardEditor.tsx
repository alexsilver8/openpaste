import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Pinboard } from '@shared/types'

export const BOARD_COLORS = [
	'#5b4cf5',
	'#0891b2',
	'#16a34a',
	'#ca8a04',
	'#ea580c',
	'#db2777',
	'#7c3aed',
	'#64748b'
]

interface BoardEditorProps {
	anchor: DOMRect
	board?: Pinboard
	onSave(input: { name: string; color: string }): void
	onDelete?(): void
	onClose(): void
}

/** Popover for creating, renaming, recoloring and deleting a pinboard. */
export function BoardEditor({ anchor, board, onSave, onDelete, onClose }: BoardEditorProps) {
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
		const onKey = (e: KeyboardEvent): void => {
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

	const submit = (e: FormEvent): void => {
		e.preventDefault()
		if (!name.trim()) return
		onSave({ name: name.trim(), color })
	}

	return createPortal(
		<form
			ref={ref}
			className="popover board-editor"
			style={{ left, top: anchor.bottom + 8 }}
			onSubmit={submit}
			onKeyDown={(e) => e.stopPropagation()}
			aria-label={board ? `Edit ${board.name}` : 'New pinboard'}
		>
			<input
				autoFocus
				className="text-input"
				placeholder="Pinboard name"
				maxLength={40}
				value={name}
				onChange={(e) => setName(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') submit(e)
				}}
			/>
			<div className="swatches" role="radiogroup" aria-label="Color">
				{BOARD_COLORS.map((c) => (
					<button
						key={c}
						type="button"
						role="radio"
						aria-checked={c === color}
						aria-label={c}
						className={`swatch${c === color ? ' is-selected' : ''}`}
						style={{ background: c }}
						onClick={() => setColor(c)}
					/>
				))}
			</div>
			<div className="popover-actions">
				{board && onDelete && (
					<button
						type="button"
						className={`button button--quiet${confirmDelete ? ' button--danger' : ''}`}
						onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
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
