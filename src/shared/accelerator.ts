/** Helpers for recording and displaying Electron accelerators (global shortcuts). */

export type Platform = 'darwin' | 'win32' | 'linux' | 'web'

export interface KeyLike {
	key: string
	code: string
	metaKey: boolean
	ctrlKey: boolean
	altKey: boolean
	shiftKey: boolean
}

const CODE_MAP: Record<string, string> = {
	Space: 'Space',
	Enter: 'Return',
	NumpadEnter: 'Enter',
	Tab: 'Tab',
	Backspace: 'Backspace',
	Delete: 'Delete',
	Insert: 'Insert',
	Home: 'Home',
	End: 'End',
	PageUp: 'PageUp',
	PageDown: 'PageDown',
	ArrowUp: 'Up',
	ArrowDown: 'Down',
	ArrowLeft: 'Left',
	ArrowRight: 'Right',
	Minus: '-',
	Equal: '=',
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	Semicolon: ';',
	Quote: "'",
	Comma: ',',
	Period: '.',
	Slash: '/',
	Backquote: '`',
	NumpadAdd: 'numadd',
	NumpadSubtract: 'numsub',
	NumpadMultiply: 'nummult',
	NumpadDivide: 'numdiv',
	NumpadDecimal: 'numdec'
}

const MODIFIER_CODES = new Set([
	'ShiftLeft',
	'ShiftRight',
	'ControlLeft',
	'ControlRight',
	'AltLeft',
	'AltRight',
	'MetaLeft',
	'MetaRight',
	'OSLeft',
	'OSRight',
	'CapsLock',
	'Fn'
])

function keyFromCode(code: string): string | null {
	if (/^Key[A-Z]$/.test(code)) return code.slice(3)
	if (/^Digit[0-9]$/.test(code)) return code.slice(5)
	if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`
	if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code

	return CODE_MAP[code] ?? null
}

/**
 * Converts a keyboard event into an Electron accelerator string.
 * Returns null while only modifiers are held, or when the combination isn't a
 * sensible global shortcut (a plain letter with no modifier, for instance).
 */
export function keyEventToAccelerator(event: KeyLike, platform: Platform): string | null {
	if (MODIFIER_CODES.has(event.code)) return null
	const key = keyFromCode(event.code)
	if (!key) return null

	const parts: string[] = []
	if (platform === 'darwin') {
		if (event.ctrlKey) parts.push('Control')
		if (event.altKey) parts.push('Alt')
		if (event.shiftKey) parts.push('Shift')
		if (event.metaKey) parts.push('Command')
	} else {
		if (event.ctrlKey) parts.push('Control')
		if (event.altKey) parts.push('Alt')
		if (event.shiftKey) parts.push('Shift')
		if (event.metaKey) parts.push('Super')
	}

	const hasRealModifier = event.ctrlKey || event.altKey || event.metaKey
	const isFunctionKey = /^F\d+$/.test(key)
	if (!hasRealModifier && !isFunctionKey) return null

	parts.push(key)

	return parts.join('+')
}

const MAC_SYMBOLS: Record<string, string> = {
	Command: '⌘',
	Cmd: '⌘',
	CommandOrControl: '⌘',
	CmdOrCtrl: '⌘',
	Control: '⌃',
	Ctrl: '⌃',
	Alt: '⌥',
	Option: '⌥',
	AltGr: '⌥',
	Shift: '⇧',
	Super: '⌘',
	Meta: '⌘',
	Return: '↩',
	Enter: '⌤',
	Backspace: '⌫',
	Delete: '⌦',
	Escape: '⎋',
	Esc: '⎋',
	Tab: '⇥',
	Space: 'Space',
	Up: '↑',
	Down: '↓',
	Left: '←',
	Right: '→',
	PageUp: '⇞',
	PageDown: '⇟',
	Home: '↖',
	End: '↘'
}

const PC_NAMES: Record<string, string> = {
	Command: 'Win',
	Cmd: 'Win',
	CommandOrControl: 'Ctrl',
	CmdOrCtrl: 'Ctrl',
	Control: 'Ctrl',
	Super: 'Win',
	Meta: 'Win',
	Return: 'Enter',
	Escape: 'Esc',
	Up: '↑',
	Down: '↓',
	Left: '←',
	Right: '→'
}

/** Formats an accelerator for display: `⇧⌘V` on macOS, `Ctrl+Shift+V` elsewhere. */
export function formatAccelerator(accelerator: string, platform: Platform): string {
	if (!accelerator) return ''
	const parts = accelerator.split('+').filter(Boolean)
	if (platform === 'darwin') {
		// macOS convention orders modifiers ⌃⌥⇧⌘.
		const order = ['⌃', '⌥', '⇧', '⌘']
		const mapped = parts.map((p) => MAC_SYMBOLS[p] ?? p.toUpperCase())
		const mods = mapped.slice(0, -1).sort((a, b) => order.indexOf(a) - order.indexOf(b))

		return [...mods, mapped[mapped.length - 1]].join('')
	}

	return parts.map((p) => PC_NAMES[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join('+')
}

/** The modifier symbol used for in-app shortcuts (⌘ or Ctrl). */
export function modKeyLabel(platform: Platform): string {
	return platform === 'darwin' ? '⌘' : 'Ctrl+'
}
