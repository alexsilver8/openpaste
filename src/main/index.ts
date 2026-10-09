import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, nativeTheme } from 'electron'
import { CaptureService } from './capture'
import { Controller } from './controller'
import { AppIcons } from './icons'
import { registerIpc } from './ipc'
import { WinHelper } from './platform/win-helper'
import { handleScheme, registerSchemePrivileges } from './protocol'
import { SettingsStore } from './settings'
import { HistoryStore } from './store'
import { AppTray } from './tray'
import { ClipboardWatcher } from './watcher'
import { getSettingsWindow, openSettingsWindow, sendEvent, Shelf } from './windows'
import { setLaunchAtLogin } from './autostart'

// Development hook: keep test runs away from your real history.
if (process.env.OPENPASTE_DATA_DIR) app.setPath('userData', process.env.OPENPASTE_DATA_DIR)

if (!app.requestSingleInstanceLock()) {
	app.quit()
} else {
	registerSchemePrivileges()
	start()
}

async function start(): Promise<void> {
	let controller: Controller | null = null

	// `openpaste --toggle` from a system keyboard shortcut (handy on Wayland) or a second launch.
	app.on('second-instance', (_event, argv) => {
		if (!controller) return
		if (argv.includes('--settings')) controller.openSettings()
		else if (argv.includes('--toggle')) controller.toggleShelf()
		else controller.showShelf()
	})

	await app.whenReady()
	if (process.platform === 'darwin') app.dock?.hide()
	if (process.platform === 'win32') app.setAppUserModelId('dev.openpaste.app')

	const userData = app.getPath('userData')
	const settings = new SettingsStore(join(userData, 'settings.json'))
	const store = new HistoryStore(join(userData, 'data'))
	store.load()
	store.prune(settings.get())
	setTimeout(() => store.sweepOrphans(), 5_000).unref()

	nativeTheme.themeSource = settings.get().theme
	handleScheme({ images: store.imageDir, icons: store.iconDir })

	const helper = process.platform === 'win32' ? new WinHelper(userData) : null
	helper?.start()

	const watcher = new ClipboardWatcher({
		interval: 500,
		changeToken: helper ? () => helper.sequence() : undefined
	})
	const shelf = new Shelf()
	controller = new Controller(store, settings, shelf, watcher, helper)
	const ctl = controller
	registerIpc(ctl)

	const capture = new CaptureService({
		store,
		helper,
		icons: new AppIcons(store.iconDir),
		settings: () => settings.get()
	})
	watcher.on('change', (event) => {
		capture.handle(event).catch((error) => console.error('[openpaste] capture failed:', error))
	})
	watcher.start()

	// Tell every open window when something changes (coalesced).
	const pending = new Set<'history-changed' | 'boards-changed' | 'settings-changed'>()
	let flush: NodeJS.Timeout | null = null
	const broadcast = (event: 'history-changed' | 'boards-changed' | 'settings-changed'): void => {
		pending.add(event)
		flush ??= setTimeout(() => {
			flush = null
			for (const e of pending) {
				sendEvent(shelf.win, e)
				sendEvent(getSettingsWindow(), e)
			}
			pending.clear()
		}, 30)
	}
	store.on('changed', () => broadcast('history-changed'))
	store.on('boards', () => broadcast('boards-changed'))

	const tray = new AppTray({
		toggleShelf: () => ctl.toggleShelf(),
		openSettings: () => ctl.openSettings(),
		setPaused: (paused) => ctl.updateSettings({ paused }),
		clearHistory: () => {
			ctl.confirmClearHistory()
		},
		about: () => ctl.about(),
		quit: () => app.quit()
	})
	tray.update(settings.get())

	settings.on('changed', (next, previous) => {
		ctl.applySettings(next, previous)
		tray.update(next)
		broadcast('settings-changed')
	})

	if (!ctl.registerShortcut()) {
		ctl.notify(
			'Shortcut unavailable',
			`${settings.get().shortcut} is used by another app. Pick a different one in OpenPaste Settings.`
		)
	}
	setLaunchAtLogin(settings.get().launchAtLogin)

	// Retention runs hourly as well as on every new copy.
	setInterval(() => store.prune(settings.get()), 60 * 60 * 1000).unref()

	const argv = process.argv
	const firstRun = settings.get().firstRun
	shelf.win.webContents.once('did-finish-load', () => {
		if (argv.includes('--settings')) openSettingsWindow()
		else if (
			firstRun ||
			argv.includes('--toggle') ||
			(!argv.includes('--hidden') && !app.isPackaged)
		) {
			ctl.showShelf()
		}
		if (firstRun) settings.set({ firstRun: false })
		if (process.env.OPENPASTE_SCREENSHOT) screenshot(shelf, process.env.OPENPASTE_SCREENSHOT)
	})

	app.on('window-all-closed', () => {
		/* OpenPaste lives in the tray; closing Settings shouldn't quit it. */
	})
	app.on('before-quit', () => {
		watcher.stop()
		helper?.dispose()
		tray.destroy()
		store.close()
	})
	app.on('activate', () => ctl.openSettings())
}

/**
 * Development hook used by the smoke test (never active in packaged builds): optionally
 * runs OPENPASTE_E2E_JS in the shelf and prints the clipboard, saves a picture, then quits.
 */
async function screenshot(shelf: Shelf, file: string): Promise<void> {
	if (app.isPackaged) return
	await new Promise((r) => setTimeout(r, Number(process.env.OPENPASTE_SCREENSHOT_DELAY ?? 1500)))
	if (process.env.OPENPASTE_E2E_JS) {
		const result: unknown = await shelf.win.webContents.executeJavaScript(
			process.env.OPENPASTE_E2E_JS
		)
		console.log('[e2e] result', JSON.stringify(result))
		console.log('[e2e] clipboard', JSON.stringify(await clipboard.readText()))
	}
	const win: BrowserWindow = getSettingsWindow() ?? shelf.win
	const image = await win.webContents.capturePage()
	writeFileSync(file, image.toPNG())
	app.quit()
}
