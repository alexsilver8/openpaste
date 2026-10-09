import {
	memo,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type MouseEvent
} from 'react'
import { createPortal } from 'react-dom'
import { MenuItem } from './components/menu-item'
import type { MenuEntry, MenuProps } from './menu.props'

/**
 * A small in-window menu. The shelf is a short window, so the menu measures itself
 * and flips up or left to stay fully visible.
 */
const Menu = (props: MenuProps): ReactNode => {
	const { x, y, entries, onClose, onDone, nested } = props

	const ref = useRef<HTMLDivElement>(null)
	const [pos, setPos] = useState({ left: x, top: y })
	const [active, setActive] = useState(-1)
	const [openSub, setOpenSub] = useState<number | null>(null)
	const [subPos, setSubPos] = useState({ x: 0, y: 0 })

	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const { width, height } = el.getBoundingClientRect()
		const vw = window.innerWidth
		const vh = window.innerHeight
		let left = x
		let top = y
		if (left + width > vw - 6) left = nested ? x - width * 2 - 4 : vw - width - 6
		if (top + height > vh - 6) top = Math.max(6, vh - height - 6)
		setPos({ left: Math.max(6, left), top })
	}, [x, y, nested])

	useEffect(() => {
		if (nested) return
		const onDown = (e: globalThis.MouseEvent): void => {
			if (!(e.target as HTMLElement).closest('.menu')) onClose()
		}
		window.addEventListener('mousedown', onDown, true)
		window.addEventListener('blur', onClose)

		return () => {
			window.removeEventListener('mousedown', onDown, true)
			window.removeEventListener('blur', onClose)
		}
	}, [onClose, nested])

	const selectable = entries
		.map((e, i) => (e !== 'separator' && !e.disabled ? i : -1))
		.filter((i) => i >= 0)

	const openSubmenu = (index: number): void => {
		const row = ref.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
		if (!row) return
		const r = row.getBoundingClientRect()
		setSubPos({ x: r.right + 2, y: r.top - 4 })
		setOpenSub(index)
	}

	const run = (index: number): void => {
		const entry = entries[index]
		if (entry === 'separator' || entry.disabled) return
		if (entry.submenu) return openSubmenu(index)
		entry.onSelect?.()
		;(onDone ?? onClose)()
	}

	const handleItemHover = (index: number) => {
		setActive(index)
		const entry = entries[index]
		if (entry !== 'separator' && entry.submenu) openSubmenu(index)
		else setOpenSub(null)
	}

	useEffect(() => {
		if (openSub !== null) return // an open submenu owns the keyboard
		const onKey = (e: KeyboardEvent): void => {
			e.preventDefault()
			e.stopPropagation()
			const pos = selectable.indexOf(active)
			if (e.key === 'Escape' || (nested && e.key === 'ArrowLeft')) onClose()
			else if (e.key === 'ArrowDown')
				setActive(selectable[(pos + 1) % selectable.length] ?? -1)
			else if (e.key === 'ArrowUp')
				setActive(selectable[(pos - 1 + selectable.length) % selectable.length] ?? -1)
			else if ((e.key === 'Enter' || e.key === ' ') && active >= 0) run(active)
			else if (e.key === 'ArrowRight' && active >= 0) {
				const entry = entries[active]
				if (entry !== 'separator' && entry.submenu) openSubmenu(active)
			}
		}
		window.addEventListener('keydown', onKey, true)

		return () => window.removeEventListener('keydown', onKey, true)
	})

	const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => e.preventDefault()

	const handleSubmenuClose = () => setOpenSub(null)

	return createPortal(
		<>
			<div
				ref={ref}
				className="menu"
				role="menu"
				style={{ left: pos.left, top: pos.top }}
				onContextMenu={handleContextMenu}
			>
				{entries.map((entry, i) =>
					entry === 'separator' ? (
						<div key={`sep-${i}`} className="menu-sep" role="separator" />
					) : (
						<MenuItem
							key={entry.label}
							entry={entry}
							index={i}
							active={active === i}
							onHover={handleItemHover}
							onRun={run}
						/>
					)
				)}
			</div>
			{openSub !== null && entries[openSub] !== 'separator' && (
				<Menu
					nested
					x={subPos.x}
					y={subPos.y}
					entries={(entries[openSub] as { submenu: MenuEntry[] }).submenu}
					onClose={handleSubmenuClose}
					onDone={onDone ?? onClose}
				/>
			)}
		</>,
		document.body
	)
}

export default memo(Menu)
