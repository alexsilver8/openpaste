import type { ReactNode } from 'react'

export interface RowProps {
	label: string
	note?: ReactNode
	children: ReactNode
	htmlFor?: string
}
