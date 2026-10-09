/** The kinds of things OpenPaste knows how to show and paste back. */
export type ClipKind = 'text' | 'link' | 'image' | 'color' | 'code' | 'file'

export const CLIP_KINDS: ClipKind[] = ['text', 'link', 'image', 'color', 'code', 'file']

/** The app that was in front when something was copied. */
export interface SourceApp {
  name: string
  /** Bundle id (macOS), process name (Windows) or WM class (Linux). */
  id?: string
  /** File name of the cached app icon inside the data folder's `icons/` directory. */
  icon?: string
  /** Dominant color of the app icon, used to tint the card header. */
  color?: string
}

export interface ClipImage {
  /** File names inside the data folder's `images/` directory. */
  file: string
  thumb: string
  width: number
  height: number
  bytes: number
}

/** One entry in the clipboard history, as persisted in the index. */
export interface ClipItem {
  id: string
  kind: ClipKind
  /** Content fingerprint used to de-duplicate repeated copies. */
  hash: string
  createdAt: number
  /** Last time this was copied or pasted. History is sorted by this. */
  usedAt: number
  source?: SourceApp
  /** Optional user-given name, shown instead of the kind label. */
  title?: string
  /** Searchable text excerpt (capped at PREVIEW_LIMIT characters). */
  preview: string
  /** Characters for text-like items, bytes for images, number of files for files. */
  size: number
  lines?: number
  /** True when HTML or RTF formatting was captured alongside the plain text. */
  rich?: boolean
  image?: ClipImage
  files?: string[]
  url?: string
  color?: string
  /** Ids of the pinboards this item is saved to. Pinned items are never pruned. */
  pinboards: string[]
}

/** The full content of an item. Stored separately from the index. */
export interface ClipPayload {
  text?: string
  html?: string
  rtf?: string
}

/** An item as the shelf sees it: index data plus resolved image URLs. */
export interface ClipView extends ClipItem {
  thumbUrl?: string
  imageUrl?: string
  iconUrl?: string
}

export interface Pinboard {
  id: string
  name: string
  color: string
  createdAt: number
}

export type ThemeSetting = 'system' | 'light' | 'dark'

export interface Settings {
  /** Electron accelerator that opens the shelf. */
  shortcut: string
  /** Paste into the frontmost app after choosing an item. When off, OpenPaste only copies. */
  pasteDirectly: boolean
  /** Strip formatting on every paste. Shift+Enter does the opposite of this. */
  plainTextByDefault: boolean
  /** Maximum number of unpinned items to keep. 0 = unlimited. */
  historyLimit: number
  /** Days to keep unpinned items. 0 = forever. */
  historyDays: number
  /** App names or ids whose copies are never recorded. */
  ignoredApps: string[]
  /** Skip clipboard content marked as concealed/transient (password managers). */
  ignoreConcealed: boolean
  captureImages: boolean
  captureFiles: boolean
  launchAtLogin: boolean
  theme: ThemeSetting
  /** Temporarily stop recording new copies. */
  paused: boolean
  /** True until the first launch has shown the welcome shelf. */
  firstRun: boolean
}

export interface QueryOptions {
  search?: string
  /** Pinboard id to show, or null/undefined for the full history. */
  pinboard?: string | null
  kind?: ClipKind | 'all'
  limit?: number
}

export type PasteOutcome = 'pasted' | 'copied' | 'no-permission' | 'unsupported' | 'failed'

export interface PasteResult {
  outcome: PasteOutcome
  message?: string
}

export interface SettingsResult {
  ok: boolean
  settings: Settings
  error?: string
}

export interface AppEnv {
  platform: 'darwin' | 'win32' | 'linux' | 'web'
  version: string
  /** Whether the shelf window sits on a native blur material (vibrancy / acrylic). */
  material: boolean
  dataPath?: string
}

export interface Permissions {
  /** macOS Accessibility permission, needed to send ⌘V. null where not applicable. */
  accessibility: boolean | null
}

export type OpenPasteEvent = 'history-changed' | 'boards-changed' | 'settings-changed' | 'shown'

export interface ItemPatch {
  title?: string | null
  text?: string
}

/** The bridge the preload script exposes on `window.openpaste`. */
export interface OpenPasteAPI {
  getEnv(): Promise<AppEnv>
  query(options: QueryOptions): Promise<ClipView[]>
  getPayload(id: string): Promise<ClipPayload | null>
  paste(id: string, options?: { plain?: boolean }): Promise<PasteResult>
  copy(id: string, options?: { plain?: boolean }): Promise<void>
  remove(id: string): Promise<void>
  undoRemove(): Promise<boolean>
  updateItem(id: string, patch: ItemPatch): Promise<void>
  setPinned(id: string, boardId: string, pinned: boolean): Promise<void>
  listBoards(): Promise<Pinboard[]>
  createBoard(input: { name: string; color: string }): Promise<Pinboard>
  updateBoard(id: string, patch: { name?: string; color?: string }): Promise<void>
  deleteBoard(id: string): Promise<void>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<SettingsResult>
  clearHistory(options: { keepPinned: boolean }): Promise<void>
  getPermissions(): Promise<Permissions>
  openAccessibilitySettings(): void
  revealDataFolder(): void
  openExternal(url: string): void
  openSettings(): void
  hide(): void
  /** Temporarily release the global shortcut, e.g. while recording a new one. */
  setShortcutSuspended(suspended: boolean): void
  startDrag(id: string): void
  on(event: OpenPasteEvent, callback: () => void): () => void
}
