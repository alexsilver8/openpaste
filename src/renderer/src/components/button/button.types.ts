import type { ComponentProps } from 'react'

/** How a button looks: the app's button styles in base.css. */
export type ButtonVariant = 'default' | 'primary' | 'quiet' | 'danger' | 'danger-quiet' | 'icon'

export interface ButtonProps extends ComponentProps<'button'> {
	/** Defaults to `default`, an outlined button. */
	variant?: ButtonVariant
}
