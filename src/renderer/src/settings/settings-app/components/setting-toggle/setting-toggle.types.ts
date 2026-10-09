import type { Settings } from '@shared/types'

/** The settings that are on or off. */
export type BooleanSetting = {
	[K in keyof Settings]: Settings[K] extends boolean ? K : never
}[keyof Settings]

export interface SettingToggleProps {
	id: string
	setting: BooleanSetting
	settings: Settings
	onChange(patch: Partial<Settings>): void
}
