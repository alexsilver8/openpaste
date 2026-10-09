import { memo } from 'react'
import { Icon } from '@renderer/components/icon'
import type { MenuItemProps } from './menu-item.types'

const MenuItem = (props: MenuItemProps) => {
	const { entry, index, active, onHover, onRun } = props

	return (
		<button
			type="button"
			data-index={index}
			role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
			aria-checked={entry.checked}
			aria-haspopup={entry.submenu ? 'menu' : undefined}
			disabled={entry.disabled}
			className={`menu-item${entry.danger ? ' is-danger' : ''}${active ? ' is-active' : ''}`}
			onMouseEnter={() => onHover(index)}
			onClick={() => onRun(index)}
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
			{entry.checked && <Icon name="check" size={14} className="menu-check" />}
			{entry.shortcut && <kbd className="menu-shortcut">{entry.shortcut}</kbd>}
			{entry.submenu && <Icon name="chevron" size={13} className="menu-chevron" />}
		</button>
	)
}

export default memo(MenuItem)
