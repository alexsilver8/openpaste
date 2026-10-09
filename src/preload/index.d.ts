import type { OpenPasteAPI } from '../shared/types'

declare global {
  interface Window {
    /** Present inside the Electron app; undefined in the browser demo. */
    openpaste?: OpenPasteAPI
    /** Synchronous facts the shelf needs before its first paint. */
    openpasteBoot?: { platform: 'darwin' | 'win32' | 'linux'; material: boolean }
  }
}

export {}
