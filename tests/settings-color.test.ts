import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, isIgnoredApp, sanitizeSettings } from '@shared/settings'
import { dominantColor, hashColor, hexToRgb, readableOn, rgbToHsl } from '@shared/color'

describe('sanitizeSettings', () => {
  it('fills defaults and drops junk', () => {
    const s = sanitizeSettings({ historyDays: -4, theme: 'neon', shortcut: 'rm -rf /', ignoredApps: ['A', 'A', 3, ''] })
    expect(s.historyDays).toBe(DEFAULT_SETTINGS.historyDays)
    expect(s.theme).toBe('system')
    expect(s.shortcut).toBe(DEFAULT_SETTINGS.shortcut)
    expect(s.ignoredApps).toEqual(['A'])
  })
  it('keeps valid values', () => {
    const s = sanitizeSettings({ historyLimit: 500, paused: true, shortcut: 'Alt+Space' })
    expect(s).toMatchObject({ historyLimit: 500, paused: true, shortcut: 'Alt+Space' })
  })
})

describe('isIgnoredApp', () => {
  it('matches names and ids', () => {
    expect(isIgnoredApp({ name: '1Password 8' }, ['1Password'])).toBe(true)
    expect(isIgnoredApp({ name: 'Bitwarden', id: 'com.bitwarden.desktop' }, ['bitwarden'])).toBe(true)
    expect(isIgnoredApp({ name: 'Slack' }, ['1Password'])).toBe(false)
    expect(isIgnoredApp(null, ['1Password'])).toBe(false)
  })
})

describe('color helpers', () => {
  it('converts colors', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 })
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(readableOn({ r: 255, g: 255, b: 255 })).toBe('#111114')
    expect(readableOn({ r: 20, g: 20, b: 60 })).toBe('#ffffff')
  })

  it('gives stable colors for app names', () => {
    expect(hashColor('Slack')).toBe(hashColor('Slack'))
    expect(hashColor('Slack')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('finds the dominant saturated color in BGRA pixels', () => {
    const w = 4
    const h = 4
    const px = new Uint8Array(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      // 12 white pixels, 4 blue ones: the blue should win.
      const blue = i < 4
      px.set(blue ? [220, 80, 30, 255] : [255, 255, 255, 255], i * 4)
    }
    const hex = dominantColor(px, w, h)!
    const { r, g, b } = hexToRgb(hex)!
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })

  it('returns null for fully transparent icons', () => {
    expect(dominantColor(new Uint8Array(64), 4, 4)).toBeNull()
  })
})
