import type { ReactNode } from 'react'

export function Row({
	label,
	note,
	children,
	htmlFor
}: {
	label: string
	note?: ReactNode
	children: ReactNode
	htmlFor?: string
}) {
	return (
		<div className="row-setting">
			<div className="row-setting-text">
				<label className="row-setting-label" htmlFor={htmlFor}>
					{label}
				</label>
				{note && <p className="row-setting-note">{note}</p>}
			</div>
			<div className="row-setting-control">{children}</div>
		</div>
	)
}
