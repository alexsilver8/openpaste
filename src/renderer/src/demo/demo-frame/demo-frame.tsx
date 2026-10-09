import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ShelfApp } from '@renderer/shelf/shelf-app'
import { SettingsApp } from '@renderer/settings/settings-app'
import { Icon } from '@renderer/components/icon'
import { isMod, platform } from '@renderer/env'
import { demoBus, demoCapture, demoShow, type DemoPasteDetail } from '@renderer/demo/mockApi'
import { SHORTCUT } from './demo-frame.constants'
import { escapeHtml } from './demo-frame.utils'

/**
 * The browser demo: a pretend desktop with a notes window, so you can copy text on
 * the page, open the shelf with the real shortcut and paste back into the note.
 */
const DemoFrame = () => {
	const [open, setOpen] = useState(false)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const editorRef = useRef<HTMLDivElement>(null)
	const savedRange = useRef<Range | null>(null)

	const show = useCallback(() => {
		const sel = window.getSelection()
		if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
			savedRange.current = sel.getRangeAt(0).cloneRange()
		}
		setOpen(true)
		demoShow()
	}, [])

	const hide = useCallback(() => setOpen(false), [])

	useEffect(() => {
		const onShow = (): void => setOpen(true)
		const onHide = (): void => setOpen(false)
		const onSettings = (): void => {
			setOpen(false)
			setSettingsOpen(true)
		}
		const onPaste = (event: Event): void => {
			const { item, payload } = (event as CustomEvent<DemoPasteDetail>).detail
			const editor = editorRef.current
			if (!editor) return
			editor.focus()
			const sel = window.getSelection()
			if (sel) {
				sel.removeAllRanges()
				if (savedRange.current) sel.addRange(savedRange.current)
				else {
					const end = document.createRange()
					end.selectNodeContents(editor)
					end.collapse(false)
					sel.addRange(end)
				}
			}
			if (item.kind === 'image' && item.image) {
				document.execCommand(
					'insertHTML',
					false,
					`<img src="${item.image.file}" alt="Pasted image">`
				)
			} else {
				const text =
					payload?.text ??
					item.url ??
					item.color ??
					item.files?.join('\n') ??
					item.preview
				const safe = escapeHtml(text)
				document.execCommand(
					'insertHTML',
					false,
					item.kind === 'code'
						? `<pre class="demo-code">${safe}</pre><p><br></p>`
						: safe.replace(/\n/g, '<br>')
				)
			}
			const after = window.getSelection()
			savedRange.current = after?.rangeCount ? after.getRangeAt(0).cloneRange() : null
		}
		demoBus.addEventListener('show', onShow)
		demoBus.addEventListener('hide', onHide)
		demoBus.addEventListener('open-settings', onSettings)
		demoBus.addEventListener('paste', onPaste)

		return () => {
			demoBus.removeEventListener('show', onShow)
			demoBus.removeEventListener('hide', onHide)
			demoBus.removeEventListener('open-settings', onSettings)
			demoBus.removeEventListener('paste', onPaste)
		}
	}, [])

	// The real shortcut opens the shelf; copying anything on the page records it.
	useEffect(() => {
		const onKey = (e: KeyboardEvent): void => {
			if (isMod(e) && e.shiftKey && e.key.toLowerCase() === 'v') {
				e.preventDefault()
				if (open) hide()
				else show()
			} else if (e.key === 'Escape' && settingsOpen) {
				e.preventDefault()
				setSettingsOpen(false)
			}
		}
		const onCopy = (e: ClipboardEvent): void => {
			const target = e.target as HTMLElement | null
			if (target?.closest?.('.demo-shelf, .demo-modal')) return
			const text = window.getSelection()?.toString() ?? ''
			const inNote = !!editorRef.current?.contains(window.getSelection()?.anchorNode ?? null)
			setTimeout(() => demoCapture(text, inNote ? 'Notes' : 'Browser'), 0)
		}
		window.addEventListener('keydown', onKey, true)
		document.addEventListener('copy', onCopy)

		return () => {
			window.removeEventListener('keydown', onKey, true)
			document.removeEventListener('copy', onCopy)
		}
	}, [open, settingsOpen, show, hide])

	const handleShelfButtonClick = () => (open ? hide() : show())

	const handleDeskMouseDown = () => open && hide()

	const handleNoteBlur = () => {
		const sel = window.getSelection()
		if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
			savedRange.current = sel.getRangeAt(0).cloneRange()
		}
	}

	const handleModalMouseDown = () => setSettingsOpen(false)

	const handleModalPanelMouseDown = (e: MouseEvent<HTMLDivElement>) => e.stopPropagation()

	const handleModalCloseClick = () => setSettingsOpen(false)

	return (
		<div className="demo">
			<div className="demo-bar">
				<span className="demo-bar-name">OpenPaste</span>
				<span className="demo-bar-note">Browser demo of the desktop app</span>
				<button type="button" className="demo-open" onClick={handleShelfButtonClick}>
					{open ? 'Close shelf' : 'Open shelf'} <kbd>{SHORTCUT}</kbd>
				</button>
			</div>

			<main className="demo-desk" onMouseDown={handleDeskMouseDown}>
				<article className="demo-window" aria-label="Notes window">
					<div className="demo-window-bar">
						<span className="demo-dots" aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
						<span>Scratchpad</span>
					</div>
					<div
						ref={editorRef}
						className="demo-editor"
						contentEditable
						suppressContentEditableWarning
						spellCheck={false}
						onBlur={handleNoteBlur}
					>
						<p>
							<strong>Try it.</strong> Select a few words anywhere on this page and
							copy them. They land on the shelf, newest first.
						</p>
						<p>
							Then click into this note, press <kbd>{SHORTCUT}</kbd>, move with the
							arrow keys and press{' '}
							<kbd>{platform === 'darwin' ? 'Return' : 'Enter'}</kbd>. The card you
							picked is pasted right here.
						</p>
						<p>
							Type to search, press <kbd>Space</kbd> for a closer look, hold{' '}
							<kbd>{platform === 'darwin' ? '⌘' : 'Ctrl'}</kbd> to see quick-paste
							numbers, and right-click a card for everything else.
						</p>
						<p className="demo-editor-fill">Paste below this line:</p>
						<p>
							<br />
						</p>
					</div>
				</article>
			</main>

			<div
				className={`demo-shelf${open ? ' is-open' : ''}`}
				aria-hidden={!open}
				inert={!open}
			>
				<ShelfApp active={open} />
			</div>

			{!open && !settingsOpen && (
				<button type="button" className="demo-launcher" onClick={show}>
					<Icon name="paste" size={16} /> Open clipboard <kbd>{SHORTCUT}</kbd>
				</button>
			)}

			{settingsOpen && (
				<div
					className="demo-modal"
					role="dialog"
					aria-label="Settings"
					onMouseDown={handleModalMouseDown}
				>
					<div className="demo-modal-panel" onMouseDown={handleModalPanelMouseDown}>
						<button
							type="button"
							className="icon-button demo-modal-close"
							aria-label="Close settings"
							onClick={handleModalCloseClick}
						>
							<Icon name="close" />
						</button>
						<SettingsApp embedded />
					</div>
				</div>
			)}
		</div>
	)
}

export default memo(DemoFrame)
