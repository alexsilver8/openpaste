import { memo } from 'react'
import { describeColor } from '@renderer/lib/colors'
import { fileExtension, fileName, hostOf } from '@renderer/lib/format'
import { highlightCode, highlightMatches } from '@renderer/lib/highlight'
import { Icon } from '@renderer/components/icon'
import type { BodyProps } from './body.props'

const Body = (props: BodyProps) => {
	const { item, terms } = props

	switch (item.kind) {
		case 'image':
			return (
				<div className="card-image">
					{item.thumbUrl && (
						<img
							src={item.thumbUrl}
							alt=""
							draggable={false}
							loading="lazy"
							decoding="async"
						/>
					)}
				</div>
			)
		case 'color': {
			const info = describeColor(item.color ?? item.preview)

			return (
				<div className="card-color" style={{ background: item.color, color: info?.ink }}>
					<span className="card-color-hex">{info?.hex ?? item.preview}</span>
					<span className="card-color-alt">{info?.rgb}</span>
				</div>
			)
		}
		case 'link': {
			const { host, rest } = hostOf(item.url ?? item.preview)

			return (
				<div className="card-link">
					<span className="card-link-host">{highlightMatches(host, terms)}</span>
					{rest && (
						<span className="card-link-rest">{highlightMatches(rest, terms)}</span>
					)}
				</div>
			)
		}
		case 'code':
			return (
				<pre className="card-code">
					<code>
						{terms.length
							? highlightMatches(item.preview.slice(0, 900), terms)
							: highlightCode(item.preview.slice(0, 900))}
					</code>
				</pre>
			)
		case 'file': {
			const files = item.files ?? []
			if (files.length === 1) {
				const ext = fileExtension(files[0])

				return (
					<div className="card-file card-file--single">
						<span className="file-glyph">
							<Icon name="file" size={44} strokeWidth={1.1} />
							{ext && <span className="file-ext">{ext.slice(0, 4)}</span>}
						</span>
						<span className="card-file-name">
							{highlightMatches(fileName(files[0]), terms)}
						</span>
					</div>
				)
			}

			return (
				<ul className="card-file">
					{files.slice(0, 5).map((f) => (
						<li key={f}>
							<Icon name="file" size={14} />
							<span>{highlightMatches(fileName(f), terms)}</span>
						</li>
					))}
					{files.length > 5 && (
						<li className="card-file-more">{files.length - 5} more</li>
					)}
				</ul>
			)
		}
		default:
			return (
				<p className="card-text">{highlightMatches(item.preview.slice(0, 700), terms)}</p>
			)
	}
}

export default memo(Body)
