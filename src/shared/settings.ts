import type { Settings, ThemeSetting } from './types'

export const DEFAULT_IGNORED_APPS = [
	'1Password',
	'Bitwarden',
	'Dashlane',
	'KeePassXC',
	'Keychain Access',
	'LastPass',
	'Proton Pass',
	'Passwords'
]

export const DEFAULT_SETTINGS: Settings = {
	shortcut: 'CommandOrControl+Shift+V',
	pasteDirectly: true,
	plainTextByDefault: false,
	historyLimit: 2000,
	historyDays: 30,
	ignoredApps: DEFAULT_IGNORED_APPS,
	ignoreConcealed: true,
	captureImages: true,
	captureFiles: true,
	launchAtLogin: false,
	theme: 'system',
	paused: false,
	firstRun: true
}

export const HISTORY_DAY_OPTIONS = [
	{ value: 1, label: '1 day' },
	{ value: 7, label: '1 week' },
	{ value: 30, label: '1 month' },
	{ value: 90, label: '3 months' },
	{ value: 365, label: '1 year' },
	{ value: 0, label: 'Forever' }
]

export const HISTORY_LIMIT_OPTIONS = [
	{ value: 200, label: '200 items' },
	{ value: 500, label: '500 items' },
	{ value: 2000, label: '2,000 items' },
	{ value: 5000, label: '5,000 items' },
	{ value: 20000, label: '20,000 items' },
	{ value: 0, label: 'Unlimited' }
]

const THEMES: ThemeSetting[] = ['system', 'light', 'dark']

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback
}

function count(value: unknown, fallback: number, max: number): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
		? Math.min(Math.floor(value), max)
		: fallback
}

/** Merges untrusted input (a settings file, an IPC patch) over a base, dropping anything invalid. */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
	const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
	const shortcut =
		typeof raw.shortcut === 'string' && /^[\w+\-=[\];',./\\`]{1,64}$/.test(raw.shortcut)
			? raw.shortcut
			: base.shortcut
	const ignoredApps = Array.isArray(raw.ignoredApps)
		? [
				...new Set(
					raw.ignoredApps
						.filter((a): a is string => typeof a === 'string')
						.map((a) => a.trim())
						.filter((a) => a.length > 0 && a.length <= 120)
				)
			].slice(0, 200)
		: base.ignoredApps
	return {
		shortcut,
		pasteDirectly: bool(raw.pasteDirectly, base.pasteDirectly),
		plainTextByDefault: bool(raw.plainTextByDefault, base.plainTextByDefault),
		historyLimit: count(raw.historyLimit, base.historyLimit, 1_000_000),
		historyDays: count(raw.historyDays, base.historyDays, 36_500),
		ignoredApps,
		ignoreConcealed: bool(raw.ignoreConcealed, base.ignoreConcealed),
		captureImages: bool(raw.captureImages, base.captureImages),
		captureFiles: bool(raw.captureFiles, base.captureFiles),
		launchAtLogin: bool(raw.launchAtLogin, base.launchAtLogin),
		theme: THEMES.includes(raw.theme as ThemeSetting)
			? (raw.theme as ThemeSetting)
			: base.theme,
		paused: bool(raw.paused, base.paused),
		firstRun: bool(raw.firstRun, base.firstRun)
	}
}

/** True if copies from this app should never be recorded. */
export function isIgnoredApp(
	app: { name?: string; id?: string } | null | undefined,
	ignored: string[]
): boolean {
	if (!app) return false
	const name = app.name?.toLowerCase() ?? ''
	const id = app.id?.toLowerCase() ?? ''
	return ignored.some((entry) => {
		const e = entry.toLowerCase()
		return e === name || e === id || (e.length > 3 && (name.includes(e) || id.includes(e)))
	})
}
