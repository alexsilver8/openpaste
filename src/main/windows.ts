import { release } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron'
import type { OpenPasteEvent } from '@shared/types'
import type { AppInfo } from './platform/frontmost'

export const SHELF_HEIGHT = 356
const SHELF_MARGIN = 10

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

/** Windows 11 22H2+ supports the acrylic material; older builds get a solid background. */
export const nativeMaterial = isMac || (isWin && Number(release().split('.')[2] ?? 0) >= 22621)

function preloadPath(): string {
	return join(__dirname, '../preload/index.js')
}

function loadRenderer(win: BrowserWindow, view: 'shelf' | 'settings'): void {
	const devUrl = process.env['ELECTRON_RENDERER_URL']
	if (!app.isPackaged && devUrl) void win.loadURL(`${devUrl}#${view}`)
	else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: view })
}

/** Keeps windows on our own pages and sends web links to the default browser. */
function lockDown(win: BrowserWindow): void {
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:\/\//.test(url)) void shell.openExternal(url)
		return { action: 'deny' }
	})
	win.webContents.on('will-navigate', (event, url) => {
		if (url !== win.webContents.getURL()) event.preventDefault()
	})
}

function solidBackground(): string {
	return nativeTheme.shouldUseDarkColors ? '#1c1c20' : '#f3f3f5'
}

// Whether OpenPaste is the active macOS app. The shelf panel never activates it, but Settings does.
let appIsActive = false
if (isMac) {
	app.on('did-become-active', () => (appIsActive = true))
	app.on('did-resign-active', () => (appIsActive = false))
}

export function sendEvent(win: BrowserWindow | null | undefined, event: OpenPasteEvent): void {
	if (win && !win.isDestroyed()) win.webContents.send('op:event', event)
}

/**
 * The shelf: a borderless panel pinned to the bottom of the screen the pointer is on.
 * It hides when it loses focus, like a menu.
 */
export class Shelf {
	readonly win: BrowserWindow
	/** The app that was in front before the shelf opened; paste goes back there. */
	previous: AppInfo | null = null
	private keepOpen = !!process.env.OPENPASTE_KEEP_OPEN

	constructor() {
		this.win = new BrowserWindow({
			width: 1200,
			height: SHELF_HEIGHT,
			show: false,
			frame: false,
			resizable: false,
			movable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			skipTaskbar: true,
			alwaysOnTop: true,
			hasShadow: true,
			title: 'OpenPaste',
			backgroundColor: nativeMaterial ? '#00000000' : solidBackground(),
			...(isMac
				? {
						// A non-activating panel: it floats over full-screen apps and takes the keyboard
						// without making OpenPaste the active app, so macOS never switches Spaces.
						type: 'panel',
						hiddenInMissionControl: true,
						vibrancy: 'popover' as const,
						visualEffectState: 'active' as const
					}
				: {}),
			...(isWin && nativeMaterial ? { backgroundMaterial: 'acrylic' as const } : {}),
			webPreferences: {
				preload: preloadPath(),
				sandbox: true,
				contextIsolation: true,
				nodeIntegration: false,
				spellcheck: false,
				backgroundThrottling: false,
				additionalArguments: [`--op-material=${nativeMaterial ? 1 : 0}`]
			}
		})
		this.win.setAlwaysOnTop(true, 'pop-up-menu')
		this.win.setVisibleOnAllWorkspaces(true, {
			visibleOnFullScreen: true,
			skipTransformProcessType: true
		})
		lockDown(this.win)
		loadRenderer(this.win, 'shelf')

		this.win.on('blur', () => {
			if (!this.keepOpen && this.win.isVisible()) this.hide({ restoreFocus: false })
		})
		nativeTheme.on('updated', () => {
			if (!nativeMaterial) this.win.setBackgroundColor(solidBackground())
		})
	}

	get visible(): boolean {
		return this.win.isVisible()
	}

	show(previous: AppInfo | null): void {
		this.previous = previous
		const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
		const area = display.workArea
		this.win.setBounds({
			x: area.x + SHELF_MARGIN,
			y: area.y + area.height - SHELF_HEIGHT - SHELF_MARGIN,
			width: area.width - SHELF_MARGIN * 2,
			height: SHELF_HEIGHT
		})
		sendEvent(this.win, 'shown')
		// On macOS the panel becomes the key window without activating the app (no app.focus here:
		// activating would pull you out of a full-screen app into another Space).
		this.win.show()
		this.win.focus()
	}

	/**
	 * Hides the shelf. The app you were using never stopped being active on macOS, so it gets
	 * the keyboard back by itself. The exception is when OpenPaste itself was active (say,
	 * right after closing Settings): then we step aside so the paste lands in the right app.
	 */
	hide(options: { restoreFocus: boolean }): void {
		if (!this.win.isVisible()) return
		this.win.hide()
		const otherWindowsOpen = BrowserWindow.getAllWindows().some(
			(w) => w !== this.win && w.isVisible()
		)
		if (isMac && options.restoreFocus && appIsActive && !otherWindowsOpen) app.hide()
	}

	setKeepOpen(keepOpen: boolean): void {
		this.keepOpen = keepOpen || !!process.env.OPENPASTE_KEEP_OPEN
	}
}

let settingsWindow: BrowserWindow | null = null

export function getSettingsWindow(): BrowserWindow | null {
	return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null
}

export function openSettingsWindow(): BrowserWindow {
	const existing = getSettingsWindow()
	if (existing) {
		existing.show()
		existing.focus()
		if (isMac) app.focus({ steal: true })
		return existing
	}
	const win = new BrowserWindow({
		width: 760,
		height: 680,
		minWidth: 620,
		minHeight: 480,
		// The content column is 660px wide; past this the window would just be empty space.
		maxWidth: 820,
		maxHeight: 900,
		// Settings is a small utility window: the green button zooms instead of going full screen.
		fullscreenable: false,
		maximizable: false,
		show: false,
		title: 'OpenPaste Settings',
		backgroundColor: solidBackground(),
		autoHideMenuBar: true,
		...(isMac ? { titleBarStyle: 'hiddenInset' as const } : {}),
		webPreferences: {
			preload: preloadPath(),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			additionalArguments: ['--op-material=0']
		}
	})
	lockDown(win)
	loadRenderer(win, 'settings')
	win.once('ready-to-show', () => {
		if (isMac) void app.dock?.show()
		win.show()
		if (isMac) app.focus({ steal: true })
	})
	win.on('closed', () => {
		settingsWindow = null
		if (isMac) app.dock?.hide()
	})
	settingsWindow = win
	return win
}
