import { memo } from 'react'
import { Toggle } from './components/toggle'
import type { SettingToggleProps } from './setting-toggle.props'

const SettingToggle = (props: SettingToggleProps) => {
	const { id, setting, settings, onChange } = props

	return (
		<Toggle
			id={id}
			checked={settings[setting]}
			onChange={(checked) => onChange({ [setting]: checked })}
		/>
	)
}

export default memo(SettingToggle)
