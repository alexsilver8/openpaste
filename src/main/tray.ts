import { Menu, Tray, app, nativeImage } from 'electron'
import { formatAccelerator } from '@shared/accelerator'
import type { Settings } from '@shared/types'
import trayTemplateIcon from '@resources/trayTemplate.png?asset'
import trayTemplateIcon2x from '@resources/trayTemplate@2x.png?asset'
import trayColorIcon from '@resources/tray.png?asset'
import trayColorIcon2x from '@resources/tray@2x.png?asset'

export interface TrayActions {
	toggleShelf(): void
	openSettings(): void
	setPaused(paused: boolean): void
	clearHistory(): void
	about(): void
	quit(): void
}

// Referenced so the @2x variants ship next to the 1x images; Electron picks them on HiDPI screens.
void trayTemplateIcon2x
void trayColorIcon2x

export class AppTray {
	private tray: Tray

	constructor(private readonly actions: TrayActions) {
		const isMac = process.platform === 'darwin'
		const image = nativeImage.createFromPath(isMac ? trayTemplateIcon : trayColorIcon)
		if (isMac) image.setTemplateImage(true)
		this.tray = new Tray(image)
		this.tray.setToolTip('OpenPaste')
		// On Windows and Linux a click on the tray icon opens the shelf; the menu is on right-click.
		if (!isMac) this.tray.on('click', () => actions.toggleShelf())
	}

	update(settings: Settings): void {
		const platform = process.platform as 'darwin' | 'win32' | 'linux'
		const menu = Menu.buildFromTemplate([
			{
				label: `Open OpenPaste    ${formatAccelerator(settings.shortcut, platform)}`,
				click: () => this.actions.toggleShelf()
			},
			{ type: 'separator' },
			{
				label: 'Pause Capturing',
				type: 'checkbox',
				checked: settings.paused,
				click: (item) => this.actions.setPaused(item.checked)
			},
			{ label: 'Clear History…', click: () => this.actions.clearHistory() },
			{ type: 'separator' },
			{
				label: 'Settings…',
				accelerator: 'CommandOrControl+,',
				click: () => this.actions.openSettings()
			},
			{ label: `About OpenPaste ${app.getVersion()}`, click: () => this.actions.about() },
			{ type: 'separator' },
			{
				label: 'Quit OpenPaste',
				accelerator: 'CommandOrControl+Q',
				click: () => this.actions.quit()
			}
		])
		this.tray.setContextMenu(menu)
		this.tray.setToolTip(settings.paused ? 'OpenPaste (paused)' : 'OpenPaste')
	}

	destroy(): void {
		this.tray.destroy()
	}
}
