import { describe, expect, it } from 'vitest'
import { formatAccelerator, keyEventToAccelerator, type KeyLike } from '@shared/accelerator'

const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
	key: '',
	code,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...mods
})

describe('keyEventToAccelerator', () => {
	it('records macOS combinations', () => {
		expect(
			keyEventToAccelerator(key('KeyV', { metaKey: true, shiftKey: true }), 'darwin')
		).toBe('Shift+Command+V')
		expect(keyEventToAccelerator(key('Space', { altKey: true }), 'darwin')).toBe('Alt+Space')
	})
	it('records Windows/Linux combinations', () => {
		expect(keyEventToAccelerator(key('KeyV', { ctrlKey: true, shiftKey: true }), 'win32')).toBe(
			'Control+Shift+V'
		)
		expect(keyEventToAccelerator(key('Digit1', { metaKey: true }), 'linux')).toBe('Super+1')
	})
	it('ignores lone modifiers and unmodified keys', () => {
		expect(keyEventToAccelerator(key('ShiftLeft', { shiftKey: true }), 'darwin')).toBeNull()
		expect(keyEventToAccelerator(key('KeyA'), 'win32')).toBeNull()
		expect(keyEventToAccelerator(key('KeyA', { shiftKey: true }), 'win32')).toBeNull()
	})
	it('allows bare function keys', () => {
		expect(keyEventToAccelerator(key('F9'), 'linux')).toBe('F9')
	})
})

describe('formatAccelerator', () => {
	it('uses symbols in macOS order', () => {
		expect(formatAccelerator('CommandOrControl+Shift+V', 'darwin')).toBe('⇧⌘V')
		expect(formatAccelerator('Shift+Command+Alt+Space', 'darwin')).toBe('⌥⇧⌘Space')
	})
	it('spells it out elsewhere', () => {
		expect(formatAccelerator('CommandOrControl+Shift+V', 'win32')).toBe('Ctrl+Shift+V')
		expect(formatAccelerator('Super+Return', 'linux')).toBe('Win+Enter')
	})
})
