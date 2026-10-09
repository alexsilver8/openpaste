import type { Platform } from '@shared/accelerator'

const boot = typeof window !== 'undefined' ? window.openpasteBoot : undefined

/** True in the browser demo, where a mock stands in for the Electron bridge. */
export const isDemo = typeof window !== 'undefined' && !window.openpaste

/** The platform whose shortcut conventions we display (the demo follows the visitor's OS). */
export const platform: Platform =
  boot?.platform ??
  (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'darwin' : 'win32')

export const isMac = platform === 'darwin'

/** Whether the window sits on a native blur material, so the page background must stay translucent. */
export const nativeMaterial = boot?.material ?? false

/** ⌘ on macOS, Ctrl elsewhere. */
export function isMod(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac ? event.metaKey : event.ctrlKey
}

export const MOD = isMac ? '⌘' : 'Ctrl+'
export const SHIFT = isMac ? '⇧' : 'Shift+'
export const ENTER = isMac ? '↩' : 'Enter'
export const DELETE_KEY = isMac ? '⌘⌫' : 'Del'
