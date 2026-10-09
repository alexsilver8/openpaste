import { memo } from 'react'
import { Icon } from '@renderer/components/icon'
import type { KindOptionProps } from './kind-option.types'

const KindOption = (props: KindOptionProps) => {
	const { kind, icon, label, checked, onKind } = props

	return (
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={label}
			title={label}
			className="kind"
			onMouseDown={(e) => e.preventDefault()}
			onClick={() => onKind(kind)}
		>
			<Icon name={icon} size={15} />
		</button>
	)
}

export default memo(KindOption)
