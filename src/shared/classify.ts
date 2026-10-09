import type { ClipItem, ClipKind } from './types'

/** How much of each item's text is kept in the index for search and previews. */
export const PREVIEW_LIMIT = 10_000

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`
const ANGLE_OR_NUM = String.raw`${NUM}(?:%|deg|rad|grad|turn)?`
const FUNC_COLOR = new RegExp(
	String.raw`^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*` +
		String.raw`${ANGLE_OR_NUM}(?:\s*[,\s]\s*${ANGLE_OR_NUM}){2}` +
		String.raw`(?:\s*[,/]\s*${NUM}%?)?\s*\)$`,
	'i'
)

/** Returns a normalized color string if the whole text is a CSS color value. */
export function detectColor(text: string): string | null {
	const value = text.trim()
	if (value.length < 4 || value.length > 80 || value.includes('\n')) return null
	if (HEX_COLOR.test(value)) return value.toLowerCase()
	if (FUNC_COLOR.test(value)) return value.replace(/\s+/g, ' ')
	return null
}

const URL_SCHEMES = /^(?:https?|ftp|file):\/\//i
const MAILTO = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i
const BARE_WWW = /^www\.[^\s/]+\.[a-z]{2,}(?:[/?#]\S*)?$/i

/** Returns the URL if the whole text is a single link. Bare `www.` hosts get `https://`. */
export function detectUrl(text: string): string | null {
	const value = text.trim()
	if (!value || value.length > 4096 || /\s/.test(value)) return null
	let candidate: string | null = null
	if (URL_SCHEMES.test(value) || MAILTO.test(value)) candidate = value
	else if (BARE_WWW.test(value)) candidate = `https://${value}`
	if (!candidate) return null
	try {
		const url = new URL(candidate)
		if (url.protocol === 'mailto:') return candidate
		return url.hostname || url.protocol === 'file:' ? candidate : null
	} catch {
		return null
	}
}

/** Apps whose copies are almost always code. */
const CODE_APPS =
	/\b(code|cursor|windsurf|zed|xcode|intellij|webstorm|pycharm|goland|rider|clion|phpstorm|rubymine|android studio|sublime|nova|neovim|vim|emacs|notepad\+\+|devenv|visual studio|terminal|iterm|warp|ghostty|kitty|alacritty|wezterm|konsole|hyper|tabby|powershell|windowsterminal|cmd)\b/i

const CODE_KEYWORDS =
	/\b(function|const|let|var|return|import|export|class|interface|def|elif|lambda|public|private|protected|static|void|async|await|struct|impl|fn|pub|package|func|namespace|using|#include|SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|CREATE TABLE)\b|=>|::|->|\$\{|===|!==|&&|\|\|/

const SHELL_LINE =
	/^\s*(?:\$ |> |sudo |npm |npx |pnpm |yarn |bun |git |cd |ls |cat |echo |curl |wget |docker |kubectl |brew |apt |pip |python3? |node |export |chmod |mkdir |rm )/

/**
 * Heuristic code detection. Each signal adds to a score; three points makes it code.
 * The source app is a strong hint but never enough on its own for plain prose.
 */
export function looksLikeCode(text: string, sourceName?: string): boolean {
	const value = text.trim()
	if (value.length < 2) return false
	const lines = value.split(/\r?\n/)
	let score = 0

	if (sourceName && CODE_APPS.test(sourceName)) score += 2
	if (CODE_KEYWORDS.test(value)) score += 2
	if (lines.some((l) => SHELL_LINE.test(l))) {
		score += 2
		// Command-line flags are a giveaway: `npm install --save-dev x`, `ls -la`.
		if (/\s--?[a-z][\w-]*/i.test(value)) score += 1
	}

	const structural = lines.filter((l) => /[;{}]\s*$|^\s*[}\])]/.test(l)).length
	if (structural >= Math.max(1, Math.ceil(lines.length * 0.3))) score += 2

	const indented = lines.filter((l) => /^(?: {2,}|\t)\S/.test(l)).length
	if (lines.length >= 3 && indented >= lines.length * 0.3) score += 1

	const symbols = (value.match(/[{}()[\];=<>]/g) ?? []).length
	if (symbols / value.length > 0.06) score += 1

	if (/^[[{]/.test(value)) {
		try {
			JSON.parse(value)
			score += 3
		} catch {
			/* not JSON */
		}
	}
	if (/^<[a-z!?][\s\S]*>$/i.test(value) && lines.length > 1) score += 2

	// Long flowing prose is rarely code, even when copied from an editor.
	const words = value.split(/\s+/).length
	if (words > 12 && symbols / value.length < 0.01) score -= 3

	return score >= 3
}

export interface TextClassification {
	kind: Extract<ClipKind, 'text' | 'link' | 'color' | 'code'>
	url?: string
	color?: string
}

export function classifyText(text: string, sourceName?: string): TextClassification {
	const color = detectColor(text)
	if (color) return { kind: 'color', color }
	const url = detectUrl(text)
	if (url) return { kind: 'link', url }
	if (looksLikeCode(text, sourceName)) return { kind: 'code' }
	return { kind: 'text' }
}

export function summarizeText(text: string): { preview: string; size: number; lines: number } {
	let lines = 1
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++
	return { preview: text.slice(0, PREVIEW_LIMIT), size: text.length, lines }
}

export const KIND_LABELS: Record<ClipKind, string> = {
	text: 'Text',
	link: 'Link',
	image: 'Image',
	color: 'Color',
	code: 'Code',
	file: 'File'
}

export function kindLabel(item: Pick<ClipItem, 'kind' | 'files' | 'rich'>): string {
	if (item.kind === 'file' && (item.files?.length ?? 0) > 1) return 'Files'
	if (item.kind === 'text' && item.rich) return 'Rich Text'
	return KIND_LABELS[item.kind]
}

/** Fast, non-cryptographic 53-bit string hash (cyrb53). Good enough for ids and demo data. */
export function cyrb53(input: string, seed = 0): string {
	let h1 = 0xdeadbeef ^ seed
	let h2 = 0x41c6ce57 ^ seed
	for (let i = 0; i < input.length; i++) {
		const ch = input.charCodeAt(i)
		h1 = Math.imul(h1 ^ ch, 2654435761)
		h2 = Math.imul(h2 ^ ch, 1597334677)
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
