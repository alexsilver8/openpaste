import { memo, type ChangeEvent } from 'react'
import type { SettingSelectProps } from './setting-select.props'

const SettingSelect = (props: SettingSelectProps) => {
	const { id, setting, options, settings, onChange } = props

	const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
		onChange({ [setting]: Number(e.currentTarget.value) })
	}

	return (
		<select id={id} className="select" value={settings[setting]} onChange={handleChange}>
			{options.map((o) => (
				<option key={o.value} value={o.value}>
					{o.label}
				</option>
			))}
		</select>
	)
}

export default memo(SettingSelect)
