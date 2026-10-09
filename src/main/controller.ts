import { join } from 'node:path'
import { app, dialog, globalShortcut, nativeTheme, Notification, shell } from 'electron'
import type { PasteResult, Settings, SettingsResult } from '@shared/types'
import { setLaunchAtLogin } from './autostart'
import { writeItem } from './clipboard-io'
import type { HistoryStore } from './store'
import type { SettingsStore } from './settings'
import { getFrontmostApp } from './platform/frontmost'
import { sendPasteKeystroke } from './platform/paste-keys'
import type { WinHelper } from './platform/win-helper'
import { withTimeout } from './capture'
import { openSettingsWindow, type Shelf } from './windows'
import type { ClipboardWatcher } from './watcher'

/** Orchestrates the shelf, the clipboard and settings. IPC and the tray call into this. */
export class Controller {
	private shortcutSuspended = false

	constructor(
		readonly store: HistoryStore,
		readonly settings: SettingsStore,
		readonly shelf: Shelf,
		readonly watcher: ClipboardWatcher,
		readonly helper: WinHelper | null
	) {}

	// ── Shelf ──────────────────────────────────────────────────────────────

	async showShelf(): Promise<void> {
		if (this.shelf.visible) return
		// macOS restores focus with app.hide(); elsewhere we remember the window to refocus it.
		// Meanwhile, catch anything copied in the last moments (images are polled more slowly).
		const [previous] = await Promise.all([
			process.platform === 'darwin'
				? Promise.resolve(null)
				: withTimeout(getFrontmostApp(this.helper), 250, null),
			withTimeout(this.watcher.checkNow(), 300, undefined)
		])
		this.shelf.show(previous)
	}

	toggleShelf(): void {
		if (this.shelf.visible) this.hideShelf()
		else this.showShelf()
	}

	hideShelf(): void {
		const previous = this.shelf.previous
		this.shelf.hide({ restoreFocus: true })
		if (process.platform === 'win32' && previous?.window) this.helper?.activate(previous.window)
	}

	// ── Clipboard actions ──────────────────────────────────────────────────

	private async putOnClipboard(id: string, plain: boolean): Promise<boolean> {
		const item = this.store.get(id)
		if (!item) return false
		const payload =
			item.kind === 'image' || item.kind === 'file' ? null : this.store.getPayload(id)
		const imagePath = item.image ? join(this.store.imageDir, item.image.file) : undefined
		await this.watcher.writeQuietly(() => writeItem(item, payload, { plain, imagePath }))
		this.store.touch(id)

		return true
	}

	async paste(id: string, plain: boolean): Promise<PasteResult> {
		if (!(await this.putOnClipboard(id, plain)))
			return { outcome: 'failed', message: 'Item not found' }
		const target = this.shelf.previous
		this.shelf.hide({ restoreFocus: true })
		if (!this.settings.get().pasteDirectly) return { outcome: 'copied' }

		const outcome = await sendPasteKeystroke(target, this.helper)
		if (outcome === 'no-permission') {
			this.notify(
				'Let OpenPaste paste for you',
				'Your item is on the clipboard. To paste directly, turn on OpenPaste in System Settings → Privacy & Security → Accessibility.'
			)
		} else if (outcome === 'unsupported') {
			this.notify(
				'Copied to clipboard',
				'Press Ctrl+V to paste. Install xdotool (X11) or wtype (Wayland) to let OpenPaste paste for you.'
			)
		}

		return { outcome }
	}

	async copy(id: string, plain: boolean): Promise<void> {
		if (await this.putOnClipboard(id, plain)) this.hideShelf()
	}

	// ── Settings ───────────────────────────────────────────────────────────

	registerShortcut(accelerator = this.settings.get().shortcut): boolean {
		globalShortcut.unregisterAll()
		if (this.shortcutSuspended) return true
		try {
			return globalShortcut.register(accelerator, () => this.toggleShelf())
		} catch {
			return false
		}
	}

	setShortcutSuspended(suspended: boolean): void {
		this.shortcutSuspended = suspended
		this.registerShortcut()
	}

	updateSettings(patch: Partial<Settings>): SettingsResult {
		const previous = this.settings.get()
		if (patch.shortcut && patch.shortcut !== previous.shortcut && !this.shortcutSuspended) {
			if (!this.registerShortcut(patch.shortcut)) {
				this.registerShortcut(previous.shortcut)

				return {
					ok: false,
					settings: previous,
					error: 'That shortcut is taken by another app or the system. Try a different one.'
				}
			}
		}
		const next = this.settings.set(patch)

		return { ok: true, settings: next }
	}

	/** Side effects of settings changes, wherever they came from (IPC or tray). */
	applySettings(next: Settings, previous: Settings): void {
		if (next.theme !== previous.theme) nativeTheme.themeSource = next.theme
		if (next.launchAtLogin !== previous.launchAtLogin) setLaunchAtLogin(next.launchAtLogin)
		if (
			next.historyDays !== previous.historyDays ||
			next.historyLimit !== previous.historyLimit
		) {
			this.store.prune(next)
		}
		if (next.shortcut !== previous.shortcut) this.registerShortcut(next.shortcut)
	}

	async confirmClearHistory(): Promise<void> {
		const { response, checkboxChecked } = await dialog.showMessageBox({
			type: 'warning',
			message: 'Clear clipboard history?',
			detail: 'This permanently deletes everything OpenPaste has recorded.',
			buttons: ['Clear History', 'Cancel'],
			defaultId: 1,
			cancelId: 1,
			checkboxLabel: 'Keep items saved to pinboards',
			checkboxChecked: true
		})
		if (response === 0) this.store.clear({ keepPinned: checkboxChecked })
	}

	// ── Misc ───────────────────────────────────────────────────────────────

	openSettings(): void {
		this.shelf.hide({ restoreFocus: false })
		openSettingsWindow()
	}

	revealDataFolder(): void {
		shell.openPath(this.store.dir)
	}

	about(): void {
		dialog.showMessageBox({
			type: 'info',
			message: `OpenPaste ${app.getVersion()}`,
			detail: 'An open-source clipboard manager.\nMIT licensed. Your clipboard history never leaves this computer.',
			buttons: ['OK']
		})
	}

	notify(title: string, body: string): void {
		if (Notification.isSupported()) new Notification({ title, body, silent: true }).show()
	}
}
