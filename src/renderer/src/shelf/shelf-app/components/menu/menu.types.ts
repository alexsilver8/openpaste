import type { IconName } from '@renderer/components/icon'

export type MenuEntry =
	| {
			label: string
			icon?: IconName
			shortcut?: string
			danger?: boolean
			checked?: boolean
			swatch?: string
			disabled?: boolean
			onSelect?: () => void
			submenu?: MenuEntry[]
	  }
	| 'separator'

export interface MenuProps {
	x: number
	y: number
	entries: MenuEntry[]
	/** Closes this menu level. */
	onClose(): void
	/** Closes the whole menu after an item runs. Defaults to onClose. */
	onDone?: () => void
	nested?: boolean
}
