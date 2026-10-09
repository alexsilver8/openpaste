import { contextBridge, ipcRenderer } from 'electron'
import type { OpenPasteAPI, OpenPasteEvent } from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
	ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: OpenPasteAPI = {
	getEnv: () => invoke('op:env'),
	query: (options) => invoke('op:query', options),
	getPayload: (id) => invoke('op:payload', id),
	paste: (id, options) => invoke('op:paste', id, options),
	copy: (id, options) => invoke('op:copy', id, options),
	remove: (id) => invoke('op:remove', id),
	undoRemove: () => invoke('op:undo-remove'),
	updateItem: (id, patch) => invoke('op:update-item', id, patch),
	setPinned: (id, boardId, pinned) => invoke('op:set-pinned', id, boardId, pinned),
	listBoards: () => invoke('op:boards'),
	createBoard: (input) => invoke('op:create-board', input),
	updateBoard: (id, patch) => invoke('op:update-board', id, patch),
	deleteBoard: (id) => invoke('op:delete-board', id),
	getSettings: () => invoke('op:settings'),
	setSettings: (patch) => invoke('op:set-settings', patch),
	clearHistory: (options) => invoke('op:clear-history', options),
	getPermissions: () => invoke('op:permissions'),
	openAccessibilitySettings: () => ipcRenderer.send('op:open-accessibility'),
	revealDataFolder: () => ipcRenderer.send('op:reveal-data'),
	openExternal: (url) => ipcRenderer.send('op:open-external', url),
	openSettings: () => ipcRenderer.send('op:open-settings'),
	hide: () => ipcRenderer.send('op:hide'),
	setShortcutSuspended: (suspended) => ipcRenderer.send('op:suspend-shortcut', suspended),
	startDrag: (id) => ipcRenderer.send('op:start-drag', id),
	on: (event: OpenPasteEvent, callback: () => void) => {
		const listener = (_: unknown, name: OpenPasteEvent): void => {
			if (name === event) callback()
		}
		ipcRenderer.on('op:event', listener)
		return () => {
			ipcRenderer.removeListener('op:event', listener)
		}
	}
}

contextBridge.exposeInMainWorld('openpaste', api)
contextBridge.exposeInMainWorld('openpasteBoot', {
	platform: process.platform,
	material: process.argv.includes('--op-material=1')
})
