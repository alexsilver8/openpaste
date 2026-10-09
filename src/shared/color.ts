/** Small color utilities shared by the main process (icon tints) and the shelf (color cards). */

export interface RGB {
	r: number
	g: number
	b: number
}

export function hexToRgb(hex: string): RGB | null {
	const m = /^#?([0-9a-f]{3,8})$/i.exec(hex.trim())
	if (!m) return null
	let h = m[1]
	if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('')
	if (h.length !== 6 && h.length !== 8) return null
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16)
	}
}

export function rgbToHex({ r, g, b }: RGB): string {
	const c = (n: number): string =>
		Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, '0')
	return `#${c(r)}${c(g)}${c(b)}`
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
	const rn = r / 255
	const gn = g / 255
	const bn = b / 255
	const max = Math.max(rn, gn, bn)
	const min = Math.min(rn, gn, bn)
	const l = (max + min) / 2
	if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
	const d = max - min
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
	let h: number
	if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
	else if (max === gn) h = (bn - rn) / d + 2
	else h = (rn - gn) / d + 4
	return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb(h: number, s: number, l: number): RGB {
	const sn = s / 100
	const ln = l / 100
	const k = (n: number): number => (n + h / 30) % 12
	const a = sn * Math.min(ln, 1 - ln)
	const f = (n: number): number =>
		ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
	return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance({ r, g, b }: RGB): number {
	const ch = (v: number): number => {
		const c = v / 255
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	}
	return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(background: RGB): '#111114' | '#ffffff' {
	return luminance(background) > 0.42 ? '#111114' : '#ffffff'
}

/** A stable, pleasant header color for an app we have no icon for. */
export function hashColor(name: string): string {
	let h = 0
	for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
	return rgbToHex(hslToRgb(h % 360, 52, 46))
}

/**
 * Picks the dominant, saturated color of an app icon from raw BGRA pixels
 * (what Electron's `NativeImage.toBitmap()` returns). Greys, near-whites and
 * near-blacks are ignored so a white icon with a blue glyph comes out blue.
 * The result is darkened if needed so white header text stays legible.
 */
export function dominantColor(bgra: Uint8Array, width: number, height: number): string | null {
	const bins = new Array<{ weight: number; r: number; g: number; b: number }>(24)
	for (let i = 0; i < bins.length; i++) bins[i] = { weight: 0, r: 0, g: 0, b: 0 }
	let fallback = { weight: 0, r: 0, g: 0, b: 0 }

	const pixels = Math.min(width * height, Math.floor(bgra.length / 4))
	for (let p = 0; p < pixels; p++) {
		const i = p * 4
		const b = bgra[i]
		const g = bgra[i + 1]
		const r = bgra[i + 2]
		const a = bgra[i + 3]
		if (a < 160) continue
		const { h, s, l } = rgbToHsl({ r, g, b })
		if (l > 8 && l < 94) {
			fallback = {
				weight: fallback.weight + 1,
				r: fallback.r + r,
				g: fallback.g + g,
				b: fallback.b + b
			}
		}
		if (s < 28 || l < 12 || l > 88) continue
		const w = (s / 100) * (1 - Math.abs(l - 50) / 50)
		const bin = bins[Math.floor(h / 15) % 24]
		bin.weight += w
		bin.r += r * w
		bin.g += g * w
		bin.b += b * w
	}

	let best = bins[0]
	for (const bin of bins) if (bin.weight > best.weight) best = bin
	let rgb: RGB | null = null
	if (best.weight > pixels * 0.01) {
		rgb = { r: best.r / best.weight, g: best.g / best.weight, b: best.b / best.weight }
	} else if (fallback.weight > 0) {
		rgb = {
			r: fallback.r / fallback.weight,
			g: fallback.g / fallback.weight,
			b: fallback.b / fallback.weight
		}
	}
	if (!rgb) return null

	// Keep headers in a band where white text is readable.
	const hsl = rgbToHsl(rgb)
	const l = Math.min(Math.max(hsl.l, 30), 50)
	const s = Math.min(hsl.s, 85)
	return rgbToHex(hslToRgb(hsl.h, s, l))
}
