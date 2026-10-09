import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@renderer/components/icon'
import type { MenuEntry, MenuProps } from './menu.props'

/**
 * A small in-window menu. The shelf is a short window, so the menu measures itself
 * and flips up or left to stay fully visible.
 */
export function Menu({ x, y, entries, onClose, onDone, nested }: MenuProps): ReactNode {
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
		const onDown = (e: MouseEvent): void => {
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

	return createPortal(
		<>
			<div
				ref={ref}
				className="menu"
				role="menu"
				style={{ left: pos.left, top: pos.top }}
				onContextMenu={(e) => e.preventDefault()}
			>
				{entries.map((entry, i) =>
					entry === 'separator' ? (
						<div key={`sep-${i}`} className="menu-sep" role="separator" />
					) : (
						<button
							key={entry.label}
							type="button"
							data-index={i}
							role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
							aria-checked={entry.checked}
							aria-haspopup={entry.submenu ? 'menu' : undefined}
							disabled={entry.disabled}
							className={`menu-item${entry.danger ? ' is-danger' : ''}${active === i ? ' is-active' : ''}`}
							onMouseEnter={() => {
								setActive(i)
								if (entry.submenu) openSubmenu(i)
								else setOpenSub(null)
							}}
							onClick={() => run(i)}
						>
							<span className="menu-icon">
								{entry.swatch ? (
									<span
										className="board-dot board-dot--lg"
										style={{ background: entry.swatch }}
									/>
								) : entry.icon ? (
									<Icon name={entry.icon} size={15} />
								) : null}
							</span>
							<span className="menu-label">{entry.label}</span>
							{entry.checked && (
								<Icon name="check" size={14} className="menu-check" />
							)}
							{entry.shortcut && (
								<kbd className="menu-shortcut">{entry.shortcut}</kbd>
							)}
							{entry.submenu && (
								<Icon name="chevron" size={13} className="menu-chevron" />
							)}
						</button>
					)
				)}
			</div>
			{openSub !== null && entries[openSub] !== 'separator' && (
				<Menu
					nested
					x={subPos.x}
					y={subPos.y}
					entries={(entries[openSub] as { submenu: MenuEntry[] }).submenu}
					onClose={() => setOpenSub(null)}
					onDone={onDone ?? onClose}
				/>
			)}
		</>,
		document.body
	)
}
