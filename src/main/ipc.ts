import { join } from 'node:path'
import {
	app,
	ipcMain,
	nativeImage,
	shell,
	type IpcMainEvent,
	type IpcMainInvokeEvent
} from 'electron'
import {
	CLIP_KINDS,
	type AppEnv,
	type ClipItem,
	type ClipView,
	type QueryOptions
} from '@shared/types'
import type { Controller } from './controller'
import { hasAccessibility } from './platform/paste-keys'
import { nativeMaterial } from './windows'
import dragIcon from '@resources/drag.png?asset'

/** How much text each card gets over IPC; the full content is fetched on demand. */
const VIEW_PREVIEW_LIMIT = 1_000

export function toView(item: ClipItem): ClipView {
	const view: ClipView = { ...item, preview: item.preview.slice(0, VIEW_PREVIEW_LIMIT) }
	if (item.image) {
		view.thumbUrl = `openpaste://images/${encodeURIComponent(item.image.thumb)}`
		view.imageUrl = `openpaste://images/${encodeURIComponent(item.image.file)}`
	}
	if (item.source?.icon)
		view.iconUrl = `openpaste://icons/${encodeURIComponent(item.source.icon)}`
	return view
}

/** Only our own pages may talk to the main process. */
function trusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
	const url = event.senderFrame?.url ?? ''
	const devUrl = process.env['ELECTRON_RENDERER_URL']
	return url.startsWith('file://') || (!!devUrl && !app.isPackaged && url.startsWith(devUrl))
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

function sanitizeQuery(raw: unknown): QueryOptions {
	const q = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
	const kind = CLIP_KINDS.includes(q.kind as never) ? (q.kind as QueryOptions['kind']) : 'all'
	return {
		search: str(q.search).slice(0, 500),
		pinboard: typeof q.pinboard === 'string' ? q.pinboard : null,
		kind,
		limit: typeof q.limit === 'number' ? Math.max(0, Math.min(q.limit, 50_000)) : 0
	}
}

export function registerIpc(controller: Controller): void {
	const { store, settings } = controller

	const handle = (channel: string, fn: (...args: unknown[]) => unknown): void => {
		ipcMain.handle(channel, (event, ...args) => {
			if (!trusted(event)) throw new Error('Untrusted sender')
			return fn(...args)
		})
	}
	const on = (channel: string, fn: (event: IpcMainEvent, ...args: unknown[]) => void): void => {
		ipcMain.on(channel, (event, ...args) => {
			if (trusted(event)) fn(event, ...args)
		})
	}

	handle('op:env', (): AppEnv => ({
		platform: process.platform as AppEnv['platform'],
		version: app.getVersion(),
		material: nativeMaterial,
		dataPath: store.dir
	}))
	handle('op:query', (options) => store.query(sanitizeQuery(options)).map(toView))
	handle('op:payload', (id) => store.getPayload(str(id)))
	handle('op:paste', (id, options) =>
		controller.paste(str(id), !!(options as { plain?: boolean } | undefined)?.plain)
	)
	handle('op:copy', (id, options) =>
		controller.copy(str(id), !!(options as { plain?: boolean } | undefined)?.plain)
	)
	handle('op:remove', (id) => void store.remove(str(id)))
	handle('op:undo-remove', () => !!store.undoRemove())
	handle('op:update-item', (id, patch) => {
		const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>
		store.update(str(id), {
			title: p.title === null ? null : typeof p.title === 'string' ? p.title : undefined,
			text: typeof p.text === 'string' ? p.text : undefined
		})
	})
	handle('op:set-pinned', (id, boardId, pinned) =>
		store.setPinned(str(id), str(boardId), !!pinned)
	)
	handle('op:boards', () => store.listBoards())
	handle('op:create-board', (input) => {
		const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
		return store.createBoard({ name: str(i.name), color: str(i.color) })
	})
	handle('op:update-board', (id, patch) => {
		const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>
		store.updateBoard(str(id), {
			name: typeof p.name === 'string' ? p.name : undefined,
			color: typeof p.color === 'string' ? p.color : undefined
		})
	})
	handle('op:delete-board', (id) => store.deleteBoard(str(id)))
	handle('op:settings', () => settings.get())
	handle('op:set-settings', (patch) => controller.updateSettings((patch ?? {}) as never))
	handle('op:clear-history', (options) =>
		store.clear({ keepPinned: !!(options as { keepPinned?: boolean } | undefined)?.keepPinned })
	)
	handle('op:permissions', () => ({ accessibility: hasAccessibility() }))

	on('op:open-accessibility', () => {
		if (process.platform === 'darwin') {
			void shell.openExternal(
				'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
			)
		}
	})
	on('op:reveal-data', () => controller.revealDataFolder())
	on('op:open-external', (_event, url) => {
		if (typeof url === 'string' && /^https?:\/\//.test(url)) void shell.openExternal(url)
	})
	on('op:open-settings', () => controller.openSettings())
	on('op:hide', () => controller.hideShelf())
	on('op:suspend-shortcut', (_event, suspended) => controller.setShortcutSuspended(!!suspended))
	on('op:start-drag', (event, id) => {
		const item = store.get(str(id))
		if (!item) return
		if (item.kind === 'image' && item.image) {
			const thumb = nativeImage.createFromPath(join(store.imageDir, item.image.thumb))
			event.sender.startDrag({
				file: join(store.imageDir, item.image.file),
				icon: thumb.isEmpty() ? dragIcon : thumb.resize({ width: 96 })
			})
		} else if (item.kind === 'file' && item.files?.length) {
			event.sender.startDrag({ file: item.files[0], files: item.files, icon: dragIcon })
		}
	})
}
