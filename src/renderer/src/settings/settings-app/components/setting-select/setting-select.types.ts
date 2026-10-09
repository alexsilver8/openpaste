import type { Settings } from '@shared/types'

/** The settings that hold a number, chosen from a list. */
export type NumberSetting = {
	[K in keyof Settings]: Settings[K] extends number ? K : never
}[keyof Settings]

export interface SettingSelectProps {
	id: string
	setting: NumberSetting
	options: { value: number; label: string }[]
	settings: Settings
	onChange(patch: Partial<Settings>): void
}
