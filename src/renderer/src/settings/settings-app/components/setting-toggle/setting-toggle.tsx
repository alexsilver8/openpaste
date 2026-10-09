import { memo } from 'react'
import { Toggle } from './components/toggle'
import type { SettingToggleProps } from './setting-toggle.props'

const SettingToggle = (props: SettingToggleProps) => {
	const { id, setting, settings, onChange } = props

	const handleChange = (checked: boolean) => {
		onChange({ [setting]: checked })
	}

	return <Toggle id={id} checked={settings[setting]} onChange={handleChange} />
}

export default memo(SettingToggle)
