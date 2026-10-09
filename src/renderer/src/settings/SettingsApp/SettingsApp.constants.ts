import type { ThemeSetting } from '@shared/types'

export const THEMES: { value: ThemeSetting; label: string }[] = [
	{ value: 'system', label: 'Match system' },
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' }
]
