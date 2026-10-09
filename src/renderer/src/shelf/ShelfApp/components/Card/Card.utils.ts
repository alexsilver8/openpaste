import type { ClipView } from '@shared/types'
import { formatBytes, formatCount } from '../../../../lib/format'

export function meta(item: ClipView): string {
	switch (item.kind) {
		case 'image':
			return item.image
				? `${item.image.width} × ${item.image.height}, ${formatBytes(item.image.bytes)}`
				: 'Image'
		case 'file':
			return formatCount(item.size, 'file')
		case 'color':
			return item.color && !item.color.startsWith('#') ? item.color : 'Color'
		case 'code':
			return (item.lines ?? 1) > 1
				? formatCount(item.lines ?? 1, 'line')
				: formatCount(item.size, 'character')
		case 'link':
			return item.url?.startsWith('mailto:') ? 'Email address' : 'Web link'
		default:
			return formatCount(item.size, 'character')
	}
}
