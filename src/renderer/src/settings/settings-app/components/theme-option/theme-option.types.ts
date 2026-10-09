import type { ThemeSetting } from '@shared/types'

export interface ThemeOptionProps {
	value: ThemeSetting
	label: string
	checked: boolean
	onSelect(theme: ThemeSetting): void
}
