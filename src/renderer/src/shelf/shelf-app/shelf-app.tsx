import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type DragEvent,
	type MouseEvent,
	type WheelEvent
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { parseQuery } from '@shared/search'
import type { ClipKind, ClipPayload, ClipView, Pinboard, Settings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { api } from '@renderer/api'
import { DELETE_KEY, ENTER, MOD, SHIFT, isDemo, isMod } from '@renderer/env'
import { BoardEditor } from './components/board-editor'
import { CARD_GAP, CARD_WIDTH, Card } from './components/card'
import { EmptyState } from './components/empty-state'
import { Inspector } from './components/inspector'
import { Menu, type MenuEntry } from './components/menu'
import { Toast, type ToastState } from './components/toast'
import { DRAG_TYPE, TopBar } from './components/top-bar'
import { TEXT_KINDS } from './shelf-app.constants'
import { prefersReducedMotion } from './shelf-app.utils'
import type { ShelfAppProps } from './shelf-app.props'

interface MenuState {
	x: number
	y: number
	index: number
	pinOnly?: boolean
}

interface EditorState {
	anchor: DOMRect
	board?: Pinboard
	/** Pin this item to the new board once it's created. */
	pinItem?: string
}

const ShelfApp = (props: ShelfAppProps) => {
	const { active = true } = props

	const [items, setItems] = useState<ClipView[]>([])
	const [loaded, setLoaded] = useState(false)
	const [boards, setBoards] = useState<Pinboard[]>([])
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
	const [query, setQuery] = useState('')
	const [search, setSearch] = useState('')
	const [board, setBoard] = useState<string | null>(null)
	const [kind, setKind] = useState<ClipKind | 'all'>('all')
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [inspect, setInspect] = useState<{ id: string; edit?: boolean; title?: boolean } | null>(
		null
	)
	const [menu, setMenu] = useState<MenuState | null>(null)
	const [editor, setEditor] = useState<EditorState | null>(null)
	const [toast, setToast] = useState<ToastState | null>(null)
	const [showHints, setShowHints] = useState(false)
	const [now, setNow] = useState(() => Date.now())

	const inputRef = useRef<HTMLInputElement>(null)
	const scrollRef = useRef<HTMLDivElement>(null)
	const shelfRef = useRef<HTMLDivElement>(null)
	const payloadCache = useRef(new Map<string, ClipPayload | null>())
	const filters = useRef({ search, board, kind })

	// ── Data ─────────────────────────────────────────────────────────────────

	const load = useCallback(async () => {
		const { search, board, kind } = filters.current
		const result = await api.query({ search, pinboard: board, kind })
		setItems(result)
		setLoaded(true)
	}, [])

	useEffect(() => {
		filters.current = { search, board, kind }
		setSelectedId(null)
		load()
	}, [search, board, kind, load])

	useEffect(() => {
		const timer = setTimeout(() => setSearch(query), 60)

		return () => clearTimeout(timer)
	}, [query])

	useEffect(() => {
		const loadBoards = (): void => {
			api.listBoards().then(setBoards)
		}
		const loadSettings = (): void => {
			api.getSettings().then(setSettings)
		}
		loadBoards()
		loadSettings()
		const offs = [
			api.on('history-changed', () => {
				load()
			}),
			api.on('boards-changed', loadBoards),
			api.on('settings-changed', loadSettings)
		]
		const tick = setInterval(() => setNow(Date.now()), 30_000)

		return () => {
			offs.forEach((off) => off())
			clearInterval(tick)
		}
	}, [load])

	// If the open board is deleted, fall back to history.
	useEffect(() => {
		if (board && boards.length && !boards.some((b) => b.id === board)) setBoard(null)
	}, [boards, board])

	useEffect(() => {
		document.documentElement.dataset.theme = settings.theme
	}, [settings.theme])

	// ── Selection & scrolling ────────────────────────────────────────────────

	const index = Math.max(
		0,
		items.findIndex((i) => i.id === selectedId)
	)
	const selected: ClipView | undefined = items[index]

	const virtualizer = useVirtualizer({
		horizontal: true,
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => CARD_WIDTH + CARD_GAP,
		getItemKey: (i) => items[i]?.id ?? i,
		overscan: 6,
		paddingStart: 16,
		paddingEnd: 16 - CARD_GAP
	})

	useEffect(() => {
		if (items.length) virtualizer.scrollToIndex(index, { align: 'auto' })
	}, [index, items.length, virtualizer])

	// Keep the selected item's full content handy so drags carry all of it.
	useEffect(() => {
		if (!selected || payloadCache.current.has(selected.id)) return
		if (selected.kind === 'image' || selected.kind === 'file') return
		api.getPayload(selected.id).then((p) => payloadCache.current.set(selected.id, p))
	}, [selected])

	const select = useCallback(
		(i: number) => {
			const target = items[Math.max(0, Math.min(i, items.length - 1))]
			if (target) setSelectedId(target.id)
		},
		[items]
	)

	// Every time the shelf opens: fresh search, first card, and a short slide-up.
	useEffect(
		() =>
			api.on('shown', () => {
				setQuery('')
				setSearch('')
				setInspect(null)
				setMenu(null)
				setEditor(null)
				setSelectedId(null)
				setNow(Date.now())
				scrollRef.current?.scrollTo({ left: 0 })
				requestAnimationFrame(() => inputRef.current?.focus())
				if (!prefersReducedMotion()) {
					shelfRef.current?.animate(
						[
							{ opacity: 0, transform: 'translateY(14px)' },
							{ opacity: 1, transform: 'none' }
						],
						{ duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' }
					)
				}
			}),
		[]
	)

	useEffect(() => {
		if (active) inputRef.current?.focus()
	}, [active])

	// ── Actions ──────────────────────────────────────────────────────────────

	const showToast = useCallback((message: string, action?: ToastState['action']) => {
		setToast({ id: Date.now(), message, action })
	}, [])
	const dismissToast = useCallback(() => setToast(null), [])

	const paste = useCallback(
		async (i: number, invert: boolean) => {
			const item = items[i]
			if (!item) return
			const plain = settings.plainTextByDefault !== invert
			const result = await api.paste(item.id, { plain })
			if (result.outcome === 'failed') showToast('That item is no longer available')
		},
		[items, settings.plainTextByDefault, showToast]
	)

	const copy = useCallback(
		(i: number) => {
			const item = items[i]
			if (item) api.copy(item.id, { plain: settings.plainTextByDefault })
		},
		[items, settings.plainTextByDefault]
	)

	const remove = useCallback(
		(i: number) => {
			const item = items[i]
			if (!item) return
			const next = items[i + 1] ?? items[i - 1]
			setSelectedId(next?.id ?? null)
			setInspect(null)
			api.remove(item.id)
			showToast('Deleted', {
				label: 'Undo',
				run: () => {
					api.undoRemove()
				}
			})
		},
		[items, showToast]
	)

	const togglePin = useCallback((item: ClipView, boardId: string) => {
		api.setPinned(item.id, boardId, !item.pinboards.includes(boardId))
	}, [])

	const cardRect = (i: number): DOMRect | undefined =>
		document.getElementById(`card-${items[i]?.id}`)?.getBoundingClientRect()

	const openPinMenu = (i: number): void => {
		const rect = cardRect(i)
		if (rect) setMenu({ x: rect.left + 12, y: rect.top + 60, index: i, pinOnly: true })
	}

	const pinEntries = (item: ClipView, i: number): MenuEntry[] => [
		...boards.map((b): MenuEntry => ({
			label: b.name,
			swatch: b.color,
			checked: item.pinboards.includes(b.id),
			onSelect: () => togglePin(item, b.id)
		})),
		...(boards.length ? (['separator'] as MenuEntry[]) : []),
		{
			label: 'New pinboard…',
			icon: 'plus',
			onSelect: () => {
				const rect = cardRect(i)
				if (rect) setEditor({ anchor: rect, pinItem: item.id })
			}
		}
	]

	const menuEntries = (i: number): MenuEntry[] => {
		const item = items[i]
		if (!item) return []
		const textual = TEXT_KINDS.has(item.kind)
		const entries: MenuEntry[] = [
			{
				label: settings.pasteDirectly ? 'Paste' : 'Copy and close',
				icon: 'paste',
				shortcut: ENTER,
				onSelect: () => {
					paste(i, false)
				}
			}
		]
		if (textual && (item.rich || settings.plainTextByDefault)) {
			entries.push({
				label: settings.plainTextByDefault
					? 'Paste with formatting'
					: 'Paste as plain text',
				shortcut: `${SHIFT}${ENTER}`,
				onSelect: () => {
					paste(i, true)
				}
			})
		}
		entries.push(
			{ label: 'Copy', icon: 'copy', shortcut: `${MOD}C`, onSelect: () => copy(i) },
			'separator',
			{
				label: 'Preview',
				icon: 'eye',
				shortcut: 'Space',
				onSelect: () => setInspect({ id: item.id })
			}
		)
		if (textual) {
			entries.push({
				label: 'Edit text',
				icon: 'edit',
				shortcut: `${MOD}E`,
				onSelect: () => setInspect({ id: item.id, edit: true })
			})
		}
		entries.push({
			label: 'Rename',
			icon: 'tag',
			shortcut: `${MOD}R`,
			onSelect: () => setInspect({ id: item.id, title: true })
		})
		if (item.kind === 'link' && item.url && /^https?:/.test(item.url)) {
			const url = item.url
			entries.push({
				label: 'Open in browser',
				icon: 'external',
				shortcut: `${MOD}O`,
				onSelect: () => api.openExternal(url)
			})
		}
		entries.push(
			{ label: 'Pin to', icon: 'pin', shortcut: `${MOD}P`, submenu: pinEntries(item, i) },
			'separator',
			{
				label: 'Delete',
				icon: 'trash',
				danger: true,
				shortcut: DELETE_KEY,
				onSelect: () => remove(i)
			}
		)

		return entries
	}

	// ── Keyboard ─────────────────────────────────────────────────────────────

	useEffect(() => {
		let hintTimer: ReturnType<typeof setTimeout> | undefined
		if (!active) return // the browser demo keeps the shelf mounted while it's closed
		const onKeyDown = (e: KeyboardEvent): void => {
			if (inspect || menu || editor) return // those layers handle their own keys
			const mod = isMod(e)
			const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
			const input = inputRef.current
			const inInput = e.target === input

			if (e.key === 'Meta' || e.key === 'Control') {
				clearTimeout(hintTimer)
				hintTimer = setTimeout(() => setShowHints(true), 250)

				return
			}

			const handled = (): void => e.preventDefault()

			if (key === 'Escape') {
				handled()
				if (query) setQuery('')
				else api.hide()
			} else if (key === 'ArrowRight' || key === 'ArrowLeft') {
				handled()
				const step = key === 'ArrowRight' ? 1 : -1
				select(mod ? (step > 0 ? items.length - 1 : 0) : index + step)
			} else if (key === 'Home' && (!inInput || !query)) {
				handled()
				select(0)
			} else if (key === 'End' && (!inInput || !query)) {
				handled()
				select(items.length - 1)
			} else if (key === 'Enter') {
				handled()
				paste(index, e.shiftKey)
			} else if (mod && /^[1-9]$/.test(key)) {
				handled()
				paste(Number(key) - 1, e.shiftKey)
			} else if (mod && key === 'c') {
				const hasTextSelection =
					inInput && input && input.selectionStart !== input.selectionEnd
				if (!hasTextSelection) {
					handled()
					copy(index)
				}
			} else if (key === ' ' && !query) {
				handled()
				if (selected) setInspect({ id: selected.id })
			} else if (
				(mod && (key === 'Backspace' || key === 'Delete')) ||
				(key === 'Delete' && !query)
			) {
				handled()
				remove(index)
			} else if (mod && key === 'e' && selected && TEXT_KINDS.has(selected.kind)) {
				handled()
				setInspect({ id: selected.id, edit: true })
			} else if (mod && key === 'r' && selected) {
				handled()
				setInspect({ id: selected.id, title: true })
			} else if (mod && key === 'p' && selected) {
				handled()
				openPinMenu(index)
			} else if (mod && key === 'o' && selected?.url && /^https?:/.test(selected.url)) {
				handled()
				api.openExternal(selected.url)
			} else if (key === 'Tab') {
				handled()
				const order = [null, ...boards.map((b) => b.id)]
				const at = order.indexOf(board)
				setBoard(order[(at + (e.shiftKey ? -1 : 1) + order.length) % order.length])
			} else if (mod && key === 'f') {
				handled()
				input?.focus()
				input?.select()
			} else if (mod && key === ',') {
				handled()
				api.openSettings()
			} else if (!inInput && key.length === 1 && !mod && !e.altKey) {
				input?.focus() // the keystroke lands in the search field
			}
		}
		const onKeyUp = (e: KeyboardEvent): void => {
			if (!e.metaKey && !e.ctrlKey) {
				clearTimeout(hintTimer)
				setShowHints(false)
			}
		}
		const reset = (): void => {
			clearTimeout(hintTimer)
			setShowHints(false)
		}
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)
		window.addEventListener('blur', reset)

		return () => {
			clearTimeout(hintTimer)
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('keyup', onKeyUp)
			window.removeEventListener('blur', reset)
		}
	})

	// ── Mouse ────────────────────────────────────────────────────────────────

	const onCardMenu = useCallback(
		(i: number, e: MouseEvent) => {
			e.preventDefault()
			select(i)
			setMenu({ x: e.clientX, y: e.clientY, index: i })
		},
		[select]
	)

	const onActivate = useCallback(
		(i: number) => {
			paste(i, false)
		},
		[paste]
	)

	const onDragStart = useCallback(
		(i: number, e: DragEvent) => {
			const item = items[i]
			if (!item) return
			setSelectedId(item.id)
			if (!isDemo && (item.kind === 'image' || item.kind === 'file')) {
				// Native drag so images and files drop into Finder, Explorer, chat apps…
				e.preventDefault()
				api.startDrag(item.id)

				return
			}
			const payload = payloadCache.current.get(item.id)
			e.dataTransfer.effectAllowed = 'copyLink'
			e.dataTransfer.setData(DRAG_TYPE, item.id)
			e.dataTransfer.setData(
				'text/plain',
				payload?.text ?? item.url ?? item.color ?? item.preview
			)
			if (item.url) e.dataTransfer.setData('text/uri-list', item.url)
			if (payload?.html) e.dataTransfer.setData('text/html', payload.html)
		},
		[items]
	)

	// The inspector takes over the keyboard; park focus away from the search field.
	useEffect(() => {
		if (inspect) inputRef.current?.blur()
	}, [inspect])

	const terms = useMemo(() => parseQuery(search).terms, [search])
	const coarsePointer = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
	const inspected = inspect ? items.find((i) => i.id === inspect.id) : undefined
	const boardName = boards.find((b) => b.id === board)?.name
	const emptyReason = search ? 'search' : board ? 'board' : kind !== 'all' ? 'kind' : 'history'

	const handleResume = () => {
		api.setSettings({ paused: false })
	}

	const handleNewBoard = (anchor: DOMRect) => setEditor({ anchor })

	const handleEditBoard = (b: Pinboard, anchor: DOMRect) => setEditor({ anchor, board: b })

	const handleDropOnBoard = (boardId: string, itemId: string) => {
		api.setPinned(itemId, boardId, true)
		showToast(`Pinned to ${boards.find((b) => b.id === boardId)?.name ?? 'pinboard'}`)
	}

	const handleSettings = () => api.openSettings()

	const handleRowWheel = (e: WheelEvent<HTMLDivElement>) => {
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scrollRef.current) {
			scrollRef.current.scrollLeft += e.deltaY
		}
	}

	const handleInspectorClose = () => {
		setInspect(null)
		inputRef.current?.focus()
	}

	const handleInspectorPaste = (invert: boolean) => {
		paste(index, invert)
	}

	const handleInspectorCopy = () => copy(index)

	const handleInspectorDelete = () => remove(index)

	const handleMenuClose = () => setMenu(null)

	const handleBoardEditorClose = () => setEditor(null)

	const handleBoardEditorSave = async (input: { name: string; color: string }) => {
		if (!editor) return
		if (editor.board) {
			await api.updateBoard(editor.board.id, input)
		} else {
			const created = await api.createBoard(input)
			if (editor.pinItem) await api.setPinned(editor.pinItem, created.id, true)
			else setBoard(created.id)
		}
		setEditor(null)
		inputRef.current?.focus()
	}

	const handleBoardEditorDelete = async () => {
		if (!editor?.board) return
		await api.deleteBoard(editor.board.id)
		setEditor(null)
	}

	return (
		<div className="shelf" ref={shelfRef}>
			<TopBar
				inputRef={inputRef}
				query={query}
				onQuery={setQuery}
				boards={boards}
				board={board}
				onBoard={setBoard}
				kind={kind}
				onKind={setKind}
				paused={settings.paused}
				onResume={handleResume}
				onNewBoard={handleNewBoard}
				onEditBoard={handleEditBoard}
				onDropOnBoard={handleDropOnBoard}
				onSettings={handleSettings}
			/>

			<div className={`shelf-body${inspected ? ' is-inspecting' : ''}`}>
				{loaded && items.length === 0 ? (
					<EmptyState
						reason={emptyReason}
						query={search}
						shortcut={settings.shortcut}
						boardName={boardName}
					/>
				) : (
					<div
						ref={scrollRef}
						className="row"
						role="listbox"
						aria-label={boardName ?? 'Clipboard history'}
						aria-activedescendant={selected ? `card-${selected.id}` : undefined}
						onWheel={handleRowWheel}
					>
						<div className="row-inner" style={{ width: virtualizer.getTotalSize() }}>
							{virtualizer.getVirtualItems().map((v) => {
								const item = items[v.index]

								return (
									<div
										key={item.id}
										className="slot"
										style={{ transform: `translateX(${v.start}px)` }}
									>
										<Card
											item={item}
											index={v.index}
											selected={v.index === index}
											showHint={showHints}
											tapToPaste={coarsePointer}
											boards={boards}
											terms={terms}
											now={now}
											onSelect={select}
											onActivate={onActivate}
											onMenu={onCardMenu}
											onDragStart={onDragStart}
										/>
									</div>
								)
							})}
						</div>
					</div>
				)}

				{inspected && (
					<Inspector
						key={
							inspected.id +
							(inspect?.edit ? ':edit' : '') +
							(inspect?.title ? ':title' : '')
						}
						item={inspected}
						boards={boards}
						startEditing={inspect?.edit}
						focusTitle={inspect?.title}
						onClose={handleInspectorClose}
						onPaste={handleInspectorPaste}
						onCopy={handleInspectorCopy}
						onDelete={handleInspectorDelete}
					/>
				)}

				{toast && <Toast toast={toast} onDismiss={dismissToast} />}
			</div>

			{menu && items[menu.index] && (
				<Menu
					x={menu.x}
					y={menu.y}
					entries={
						menu.pinOnly
							? pinEntries(items[menu.index], menu.index)
							: menuEntries(menu.index)
					}
					onClose={handleMenuClose}
				/>
			)}

			{editor && (
				<BoardEditor
					anchor={editor.anchor}
					board={editor.board}
					onClose={handleBoardEditorClose}
					onSave={handleBoardEditorSave}
					onDelete={editor.board ? handleBoardEditorDelete : undefined}
				/>
			)}
		</div>
	)
}

export default memo(ShelfApp)
