import type { ClipKind } from '@shared/types'
import type { IconName } from '@renderer/components/icon'

export const DRAG_TYPE = 'application/x-openpaste-id'

export const KINDS: { kind: ClipKind | 'all'; icon: IconName; label: string }[] = [
	{ kind: 'all', icon: 'all', label: 'All types' },
	{ kind: 'text', icon: 'text', label: 'Text' },
	{ kind: 'link', icon: 'link', label: 'Links' },
	{ kind: 'image', icon: 'image', label: 'Images' },
	{ kind: 'code', icon: 'code', label: 'Code' },
	{ kind: 'color', icon: 'color', label: 'Colors' },
	{ kind: 'file', icon: 'file', label: 'Files' }
]
