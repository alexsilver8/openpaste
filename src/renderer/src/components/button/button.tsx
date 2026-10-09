import { memo } from 'react'
import { VARIANT_CLASSES } from './button.constants'
import type { ButtonProps } from './button.types'

/** The app's button. It's `type="button"` unless you say otherwise, so it never submits a form by accident. */
const Button = (props: ButtonProps) => {
	const { variant = 'default', type = 'button', className, ...rest } = props

	const classes = className
		? `${VARIANT_CLASSES[variant]} ${className}`
		: VARIANT_CLASSES[variant]

	return <button type={type} className={classes} {...rest} />
}

export default memo(Button)
