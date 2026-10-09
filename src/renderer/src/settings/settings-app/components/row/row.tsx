import { memo } from 'react'
import type { RowProps } from './row.props'

const Row = ({ label, note, children, htmlFor }: RowProps) => {
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

export default memo(Row)
