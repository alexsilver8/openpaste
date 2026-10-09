import type { MenuEntry } from '@renderer/shelf/shelf-app/components/menu'

export interface MenuItemProps {
	entry: Exclude<MenuEntry, 'separator'>
	index: number
	active: boolean
	onHover(index: number): void
	onRun(index: number): void
}
