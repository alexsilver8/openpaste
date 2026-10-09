import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'

/** Turns "launch at login" on or off. Linux uses an XDG autostart entry. */
export function setLaunchAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return // Don't register the dev binary as a login item.
  if (process.platform === 'linux') {
    const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'autostart')
    const file = join(dir, 'openpaste.desktop')
    if (!enabled) {
      rmSync(file, { force: true })
      return
    }
    const exec = process.env.APPIMAGE || process.execPath
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=OpenPaste',
        'Comment=Clipboard history manager',
        `Exec="${exec}" --hidden`,
        'X-GNOME-Autostart-enabled=true',
        ''
      ].join('\n')
    )
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}
