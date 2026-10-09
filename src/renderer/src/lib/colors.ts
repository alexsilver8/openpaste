import { hexToRgb, readableOn, rgbToHex, rgbToHsl, type RGB } from '@shared/color'

let ctx: CanvasRenderingContext2D | null = null

/** Resolves any CSS color string to RGB(A) using the browser's own parser. */
export function parseCssColor(value: string): (RGB & { a: number }) | null {
	ctx ??= document.createElement('canvas').getContext('2d')
	if (!ctx) return null
	ctx.fillStyle = '#000'
	ctx.fillStyle = value
	const resolved = ctx.fillStyle
	// A parse failure leaves the previous value; double-check with a second sentinel.
	if (resolved === '#000000') {
		ctx.fillStyle = '#fff'
		ctx.fillStyle = value
		if (ctx.fillStyle === '#ffffff') return null
	}
	const hex = hexToRgb(resolved)
	if (hex) return { ...hex, a: 1 }
	const m = /rgba?\(([^)]+)\)/.exec(resolved)
	if (!m) return null
	const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim())
	return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) }
}

export interface ColorInfo {
	css: string
	hex: string
	rgb: string
	hsl: string
	ink: string
}

export function describeColor(value: string): ColorInfo | null {
	const c = parseCssColor(value)
	if (!c) return null
	const hsl = rgbToHsl(c)
	const alpha = c.a < 1 ? ` / ${Math.round(c.a * 100)}%` : ''
	return {
		css: value,
		hex: rgbToHex(c).toUpperCase(),
		rgb: `rgb(${c.r} ${c.g} ${c.b}${alpha})`,
		hsl: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%${alpha})`,
		ink: c.a < 0.5 ? 'var(--ink)' : readableOn(c)
	}
}

/** Header color for items whose source app we don't know. */
export const KIND_COLORS: Record<string, string> = {
	text: '#5b6475',
	link: '#2f6fde',
	image: '#16897a',
	color: '#c23a7b',
	code: '#3d4a5c',
	file: '#b7791f'
}
