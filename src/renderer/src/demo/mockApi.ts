import { classifyText, cyrb53, summarizeText } from '@shared/classify'
import { hashColor } from '@shared/color'
import { queryItems } from '@shared/search'
import { DEFAULT_SETTINGS, sanitizeSettings } from '@shared/settings'
import type {
	ClipItem,
	ClipPayload,
	ClipView,
	OpenPasteAPI,
	OpenPasteEvent,
	Pinboard,
	Settings
} from '@shared/types'
import { APP_COLORS, SAMPLE_BOARDS, buildSamples } from './sampleData'

/**
 * In-memory stand-in for the Electron bridge, used by the browser demo and `npm run demo`.
 * It behaves like the real app closely enough to exercise every part of the shelf UI.
 */

export interface DemoPasteDetail {
	item: ClipItem
	payload: ClipPayload | null
	plain: boolean
}

/** Demo-only events: `show`, `hide`, `paste` (DemoPasteDetail), `open-settings`. */
export const demoBus = new EventTarget()

const listeners = new Map<OpenPasteEvent, Set<() => void>>()
const emit = (event: OpenPasteEvent): void => listeners.get(event)?.forEach((cb) => cb())

// Seeded when the mock is created, so the Electron build never builds sample data.
const items = new Map<string, ClipItem>()
const payloads = new Map<string, ClipPayload>()
let boards: Pinboard[] = []
let settings: Settings = { ...DEFAULT_SETTINGS, firstRun: false }
const trash: ClipItem[] = []

function toView(item: ClipItem): ClipView {
	return { ...item, thumbUrl: item.image?.thumb, imageUrl: item.image?.file }
}

function touch(id: string): void {
	const item = items.get(id)
	if (!item) return
	item.usedAt = Date.now()
	emit('history-changed')
}

/** Records text copied anywhere on the demo page, like the real clipboard watcher would. */
export function demoCapture(text: string, sourceName = 'Browser'): void {
	if (!text.trim() || settings.paused) return
	const hash = `t:${cyrb53(text)}`
	const existing = [...items.values()].find((i) => i.hash === hash)
	if (existing) return touch(existing.id)
	const cls = classifyText(text, sourceName)
	const { preview, size, lines } = summarizeText(text)
	const id = `demo-${cyrb53(text + Date.now())}`
	items.set(id, {
		id,
		kind: cls.kind,
		hash,
		createdAt: Date.now(),
		usedAt: Date.now(),
		source: { name: sourceName, color: APP_COLORS[sourceName] ?? hashColor(sourceName) },
		preview,
		size,
		lines,
		url: cls.url,
		color: cls.color,
		pinboards: []
	})
	payloads.set(id, { text })
	emit('history-changed')
}

export function demoShow(): void {
	emit('shown')
	demoBus.dispatchEvent(new Event('show'))
}

export function createMockApi(): OpenPasteAPI {
	const seeded = buildSamples(Date.now())
	for (const item of seeded.items) items.set(item.id, item)
	for (const [id, payload] of seeded.payloads) payloads.set(id, payload)
	boards = [...SAMPLE_BOARDS]
	return {
		async getEnv() {
			return { platform: 'web', version: '0.1.0', material: false }
		},
		async query(options) {
			return queryItems(items.values(), options).map(toView)
		},
		async getPayload(id) {
			const item = items.get(id)
			if (!item) return null
			return payloads.get(id) ?? (item.kind === 'image' ? null : { text: item.preview })
		},
		async paste(id, options) {
			const item = items.get(id)
			if (!item) return { outcome: 'failed' }
			const detail: DemoPasteDetail = {
				item: { ...item },
				payload: payloads.get(id) ?? null,
				plain: !!options?.plain
			}
			touch(id)
			demoBus.dispatchEvent(new Event('hide'))
			demoBus.dispatchEvent(new CustomEvent('paste', { detail }))
			return { outcome: settings.pasteDirectly ? 'pasted' : 'copied' }
		},
		async copy(id) {
			const item = items.get(id)
			const text = payloads.get(id)?.text ?? item?.url ?? item?.color ?? item?.preview
			if (text) await navigator.clipboard?.writeText(text).catch(() => undefined)
			touch(id)
			demoBus.dispatchEvent(new Event('hide'))
		},
		async remove(id) {
			const item = items.get(id)
			if (!item) return
			items.delete(id)
			trash.push(item)
			emit('history-changed')
		},
		async undoRemove() {
			const item = trash.pop()
			if (!item) return false
			items.set(item.id, item)
			emit('history-changed')
			return true
		},
		async updateItem(id, patch) {
			const item = items.get(id)
			if (!item) return
			if (patch.title !== undefined) item.title = patch.title?.trim() || undefined
			if (typeof patch.text === 'string') {
				const cls = classifyText(patch.text, item.source?.name)
				Object.assign(item, summarizeText(patch.text), {
					kind: cls.kind,
					url: cls.url,
					color: cls.color,
					rich: undefined
				})
				payloads.set(id, { text: patch.text })
			}
			emit('history-changed')
		},
		async setPinned(id, boardId, pinned) {
			const item = items.get(id)
			if (!item) return
			item.pinboards = pinned
				? [...new Set([...item.pinboards, boardId])]
				: item.pinboards.filter((b) => b !== boardId)
			emit('history-changed')
		},
		async listBoards() {
			return [...boards]
		},
		async createBoard(input) {
			const board: Pinboard = {
				id: `board-${Date.now()}`,
				name: input.name.trim() || 'Pinboard',
				color: input.color,
				createdAt: Date.now()
			}
			boards = [...boards, board]
			emit('boards-changed')
			return board
		},
		async updateBoard(id, patch) {
			boards = boards.map((b) =>
				b.id === id
					? { ...b, name: patch.name?.trim() || b.name, color: patch.color ?? b.color }
					: b
			)
			emit('boards-changed')
		},
		async deleteBoard(id) {
			boards = boards.filter((b) => b.id !== id)
			for (const item of items.values())
				item.pinboards = item.pinboards.filter((b) => b !== id)
			emit('boards-changed')
			emit('history-changed')
		},
		async getSettings() {
			return { ...settings }
		},
		async setSettings(patch) {
			settings = sanitizeSettings({ ...settings, ...patch }, settings)
			emit('settings-changed')
			return { ok: true, settings: { ...settings } }
		},
		async clearHistory({ keepPinned }) {
			for (const [id, item] of items)
				if (!keepPinned || !item.pinboards.length) items.delete(id)
			emit('history-changed')
		},
		async getPermissions() {
			return { accessibility: null }
		},
		openAccessibilitySettings() {},
		revealDataFolder() {},
		openExternal(url) {
			window.open(url, '_blank', 'noopener')
		},
		openSettings() {
			demoBus.dispatchEvent(new Event('open-settings'))
		},
		hide() {
			demoBus.dispatchEvent(new Event('hide'))
		},
		setShortcutSuspended() {},
		startDrag() {},
		on(event, callback) {
			let set = listeners.get(event)
			if (!set) listeners.set(event, (set = new Set()))
			set.add(callback)
			return () => set.delete(callback)
		}
	}
}
