import { memo, useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react'
import { kindLabel } from '@shared/classify'
import type { ClipPayload } from '@shared/types'
import { api } from '@renderer/api'
import { describeColor } from '@renderer/lib/colors'
import { absoluteTime, formatBytes, formatCount, hostOf } from '@renderer/lib/format'
import { highlightCode } from '@renderer/lib/highlight'
import { Icon } from '@renderer/components/icon'
import { ENTER, MOD, SHIFT, isMod } from '@renderer/env'
import { BoardChip } from './components/board-chip'
import { TEXT_KINDS } from './inspector.constants'
import type { InspectorProps } from './inspector.types'

/** A larger look at one item, with editing, renaming and pinboard membership. */
const Inspector = (props: InspectorProps) => {
	const { item, boards, startEditing, focusTitle, onClose, onPaste, onCopy, onDelete } = props

	const [payload, setPayload] = useState<ClipPayload | null>(null)
	const [editing, setEditing] = useState(!!startEditing && TEXT_KINDS.has(item.kind))
	const [draft, setDraft] = useState('')
	const [title, setTitle] = useState(item.title ?? '')
	const titleRef = useRef<HTMLInputElement>(null)
	const textRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		let alive = true
		api.getPayload(item.id).then((p) => {
			if (!alive) return
			setPayload(p)
			setDraft(p?.text ?? item.preview)
		})

		return () => {
			alive = false
		}
	}, [item.id, item.preview])

	useEffect(() => setTitle(item.title ?? ''), [item.title])
	useEffect(() => {
		if (focusTitle) titleRef.current?.focus()
	}, [focusTitle])
	useEffect(() => {
		if (editing) textRef.current?.focus()
	}, [editing])

	const saveTitle = (): void => {
		if ((item.title ?? '') !== title.trim())
			api.updateItem(item.id, { title: title.trim() || null })
	}
	const saveText = (): void => {
		api.updateItem(item.id, { text: draft })
		setEditing(false)
	}

	// Inspector keys take priority over the shelf's.
	useEffect(() => {
		const onKey = (e: globalThis.KeyboardEvent): void => {
			const target = e.target as HTMLElement
			const typing = !!target.closest('.inspector') && target.matches('input, textarea')
			if (e.key === 'Escape') {
				e.preventDefault()
				e.stopPropagation()
				if (editing) {
					setEditing(false)
					setDraft(payload?.text ?? item.preview)
				} else if (typing) (e.target as HTMLElement).blur()
				else onClose()
			} else if (editing && isMod(e) && (e.key === 'Enter' || e.key === 's')) {
				e.preventDefault()
				e.stopPropagation()
				saveText()
			} else if (!typing && (e.key === ' ' || e.key === 'Enter')) {
				e.preventDefault()
				e.stopPropagation()
				if (e.key === ' ') onClose()
				else onPaste(e.shiftKey)
			}
		}
		window.addEventListener('keydown', onKey, true)

		return () => window.removeEventListener('keydown', onKey, true)
	})

	const text = payload?.text ?? item.preview
	const color = item.kind === 'color' ? describeColor(item.color ?? item.preview) : null

	let content: ReactNode
	if (editing) {
		content = (
			<textarea
				ref={textRef}
				className="inspector-editor"
				value={draft}
				spellCheck={item.kind === 'text'}
				onChange={(e) => setDraft(e.currentTarget.value)}
			/>
		)
	} else if (item.kind === 'image') {
		content = (
			<div className="inspector-image">
				<img
					src={item.imageUrl ?? item.thumbUrl}
					alt={item.title ?? 'Copied image'}
					draggable={false}
				/>
			</div>
		)
	} else if (item.kind === 'color' && color) {
		content = (
			<div className="inspector-color">
				<div
					className="inspector-swatch"
					style={{ background: item.color, color: color.ink }}
				>
					{color.hex}
				</div>
				<dl className="inspector-values">
					{[
						['Hex', color.hex],
						['RGB', color.rgb],
						['HSL', color.hsl],
						['Copied as', item.color ?? item.preview]
					].map(([k, v]) => (
						<div key={k}>
							<dt>{k}</dt>
							<dd>{v}</dd>
						</div>
					))}
				</dl>
			</div>
		)
	} else if (item.kind === 'link') {
		const { host } = hostOf(item.url ?? text)
		content = (
			<div className="inspector-link">
				<p className="inspector-link-host">{host}</p>
				<p className="inspector-link-url">{item.url ?? text}</p>
				{item.url && /^https?:/.test(item.url) && (
					<button
						type="button"
						className="button"
						onClick={() => api.openExternal(item.url!)}
					>
						<Icon name="external" size={15} /> Open in browser
					</button>
				)}
			</div>
		)
	} else if (item.kind === 'file') {
		content = (
			<ul className="inspector-files">
				{(item.files ?? []).map((f) => (
					<li key={f}>
						<Icon name="file" size={15} />
						<span>{f}</span>
					</li>
				))}
			</ul>
		)
	} else {
		content = (
			<pre className={`inspector-text${item.kind === 'code' ? ' is-code' : ''}`}>
				{item.kind === 'code' ? highlightCode(text) : text}
			</pre>
		)
	}

	const details: [string, string][] = [
		['From', item.source?.name ?? 'Unknown app'],
		['Copied', absoluteTime(item.createdAt)]
	]
	if (item.usedAt - item.createdAt > 60_000)
		details.push(['Last used', absoluteTime(item.usedAt)])
	if (item.image) {
		details.push(
			['Size', `${item.image.width} × ${item.image.height}`],
			['File size', formatBytes(item.image.bytes)]
		)
	} else if (item.kind === 'file') {
		details.push(['Items', formatCount(item.size, 'file')])
	} else {
		details.push(['Length', formatCount(item.size, 'character')])
		if ((item.lines ?? 1) > 1) details.push(['Lines', String(item.lines)])
		if (item.rich) details.push(['Format', 'Rich text (formatting kept)'])
	}

	const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			saveTitle()
			;(e.target as HTMLInputElement).blur()
		}
	}

	return (
		<section className="inspector" aria-label="Item details">
			<div className="inspector-main">{content}</div>
			<aside className="inspector-side">
				<div className="inspector-head">
					<input
						ref={titleRef}
						className="inspector-title"
						placeholder={kindLabel(item)}
						aria-label="Name"
						value={title}
						maxLength={120}
						onChange={(e) => setTitle(e.currentTarget.value)}
						onBlur={saveTitle}
						onKeyDown={handleTitleKeyDown}
					/>
					<button
						type="button"
						className="icon-button"
						aria-label="Close"
						onClick={onClose}
					>
						<Icon name="close" />
					</button>
				</div>
				<dl className="inspector-details">
					{details.map(([k, v]) => (
						<div key={k}>
							<dt>{k}</dt>
							<dd>{v}</dd>
						</div>
					))}
				</dl>
				{boards.length > 0 && (
					<div className="inspector-boards" role="group" aria-label="Pinboards">
						{boards.map((b) => (
							<BoardChip
								key={b.id}
								board={b}
								pinned={item.pinboards.includes(b.id)}
								onToggle={(boardId, pinned) =>
									api.setPinned(item.id, boardId, pinned)
								}
							/>
						))}
					</div>
				)}
				<div className="inspector-actions">
					{editing ? (
						<>
							<button
								type="button"
								className="button button--primary"
								onClick={saveText}
							>
								Save changes{' '}
								<kbd>
									{MOD}
									{ENTER}
								</kbd>
							</button>
							<button
								type="button"
								className="button"
								onClick={() => setEditing(false)}
							>
								Cancel
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								className="button button--primary"
								onClick={() => onPaste(false)}
							>
								Paste <kbd>{ENTER}</kbd>
							</button>
							{TEXT_KINDS.has(item.kind) && item.rich && (
								<button
									type="button"
									className="button"
									onClick={() => onPaste(true)}
								>
									Paste as plain text{' '}
									<kbd>
										{SHIFT}
										{ENTER}
									</kbd>
								</button>
							)}
							<button type="button" className="button" onClick={onCopy}>
								Copy
							</button>
							{TEXT_KINDS.has(item.kind) && (
								<button
									type="button"
									className="button"
									onClick={() => setEditing(true)}
								>
									Edit
								</button>
							)}
							<button
								type="button"
								className="button button--quiet button--danger"
								onClick={onDelete}
							>
								Delete
							</button>
						</>
					)}
				</div>
			</aside>
		</section>
	)
}

export default memo(Inspector)
