import type { ClipItem, ClipPayload, Pinboard } from '@shared/types'

/** Sample history for the browser demo. Images are generated SVGs so the demo has no assets. */

const svg = (markup: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`

const chartShot =
	svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
<rect width="1280" height="800" fill="#f7f7fa"/>
<rect x="0" y="0" width="1280" height="64" fill="#ffffff"/><rect x="0" y="64" width="1280" height="1" fill="#e4e4ea"/>
<circle cx="40" cy="32" r="12" fill="#5b4cf5"/><rect x="64" y="24" width="140" height="16" rx="8" fill="#d9d9e3"/>
<rect x="40" y="104" width="760" height="420" rx="16" fill="#fff" stroke="#e4e4ea"/>
<rect x="72" y="136" width="230" height="22" rx="11" fill="#1f1f29"/><rect x="72" y="172" width="150" height="14" rx="7" fill="#c7c7d4"/>
<g fill="#5b4cf5">${[180, 240, 210, 290, 330, 300, 380, 410, 360, 450, 470, 520]
		.map(
			(h, i) =>
				`<rect x="${92 + i * 58}" y="${500 - h * 0.55}" width="34" height="${h * 0.55}" rx="6" opacity="${0.45 + i * 0.045}"/>`
		)
		.join('')}</g>
<polyline points="${[180, 240, 210, 290, 330, 300, 380, 410, 360, 450, 470, 520]
		.map((h, i) => `${109 + i * 58},${470 - h * 0.6}`)
		.join(
			' '
		)}" fill="none" stroke="#f97316" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="832" y="104" width="408" height="200" rx="16" fill="#fff" stroke="#e4e4ea"/>
<rect x="864" y="136" width="120" height="14" rx="7" fill="#c7c7d4"/><rect x="864" y="168" width="200" height="44" rx="10" fill="#1f1f29"/>
<rect x="864" y="236" width="90" height="22" rx="11" fill="#d1fae5"/>
<rect x="832" y="324" width="408" height="200" rx="16" fill="#fff" stroke="#e4e4ea"/>
<circle cx="936" cy="424" r="62" fill="none" stroke="#ececf3" stroke-width="22"/>
<circle cx="936" cy="424" r="62" fill="none" stroke="#5b4cf5" stroke-width="22" stroke-dasharray="270 400" transform="rotate(-90 936 424)"/>
<rect x="1036" y="392" width="160" height="14" rx="7" fill="#c7c7d4"/><rect x="1036" y="420" width="110" height="14" rx="7" fill="#e4e4ea"/>
<rect x="40" y="556" width="1200" height="204" rx="16" fill="#fff" stroke="#e4e4ea"/>
${[0, 1, 2, 3].map((r) => `<rect x="72" y="${592 + r * 40}" width="${480 - r * 60}" height="14" rx="7" fill="#d9d9e3"/><rect x="1060" y="${592 + r * 40}" width="140" height="14" rx="7" fill="#ececf3"/>`).join('')}
</svg>`)

const landscape =
	svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".55" stop-color="#c2410c"/><stop offset="1" stop-color="#fdba74"/></linearGradient></defs>
<rect width="1600" height="1000" fill="url(#s)"/>
<circle cx="1080" cy="560" r="110" fill="#fde68a" opacity=".9"/>
<path d="M0 640 L220 470 L380 590 L560 400 L760 600 L940 470 L1120 640 L1300 500 L1600 660 L1600 1000 L0 1000Z" fill="#7c2d12" opacity=".75"/>
<path d="M0 760 L180 650 L420 760 L640 610 L880 760 L1100 660 L1360 770 L1600 700 L1600 1000 L0 1000Z" fill="#431407"/>
<path d="M0 880 L300 820 L620 900 L940 830 L1260 900 L1600 850 L1600 1000 L0 1000Z" fill="#1c0a03"/>
</svg>`)

const uiMock =
	svg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
<rect width="900" height="600" fill="#eef0ff"/>
<rect x="150" y="90" width="600" height="420" rx="28" fill="#fff"/>
<rect x="200" y="140" width="64" height="64" rx="18" fill="#5b4cf5"/>
<rect x="288" y="150" width="220" height="20" rx="10" fill="#1f1f29"/><rect x="288" y="182" width="150" height="14" rx="7" fill="#b9b9c9"/>
<rect x="200" y="240" width="500" height="54" rx="14" fill="#f4f4f8"/><rect x="224" y="260" width="180" height="14" rx="7" fill="#9a9aae"/>
<rect x="200" y="310" width="500" height="54" rx="14" fill="#f4f4f8"/><rect x="224" y="330" width="240" height="14" rx="7" fill="#9a9aae"/>
<rect x="200" y="400" width="500" height="64" rx="16" fill="#5b4cf5"/><rect x="380" y="424" width="140" height="16" rx="8" fill="#fff"/>
</svg>`)

interface Sample {
	minutesAgo: number
	kind: ClipItem['kind']
	source: string
	text?: string
	html?: boolean
	url?: string
	color?: string
	image?: { url: string; width: number; height: number; bytes: number }
	files?: string[]
	title?: string
	boards?: string[]
}

export const SAMPLE_BOARDS: Pinboard[] = [
	{ id: 'snippets', name: 'Snippets', color: '#5b4cf5', createdAt: 0 },
	{ id: 'brand', name: 'Brand', color: '#db2777', createdAt: 0 },
	{ id: 'replies', name: 'Replies', color: '#0891b2', createdAt: 0 }
]

export const APP_COLORS: Record<string, string> = {
	Slack: '#4a154b',
	'Google Chrome': '#1a73e8',
	'Visual Studio Code': '#0065a9',
	Figma: '#7b3fe4',
	Screenshot: '#52606d',
	Notion: '#2f2f2f',
	Terminal: '#30363d',
	Finder: '#1e7fd8',
	Mail: '#1677e6',
	Photos: '#d9480f',
	DataGrip: '#1d8a63',
	Notes: '#b7860b',
	Browser: '#3d5afe'
}

const SAMPLES: Sample[] = [
	{
		minutesAgo: 2,
		kind: 'text',
		source: 'Slack',
		text: "Can we move the design review to Thursday at 14:00? I'll bring the new onboarding flow and the empty states."
	},
	{
		minutesAgo: 6,
		kind: 'link',
		source: 'Google Chrome',
		text: 'https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API',
		url: 'https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API'
	},
	{
		minutesAgo: 14,
		kind: 'code',
		source: 'Visual Studio Code',
		boards: ['snippets'],
		text: `export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 200) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}`
	},
	{
		minutesAgo: 22,
		kind: 'color',
		source: 'Figma',
		text: '#5B4CF5',
		color: '#5b4cf5',
		boards: ['brand']
	},
	{
		minutesAgo: 35,
		kind: 'image',
		source: 'Screenshot',
		image: { url: chartShot, width: 1280, height: 800, bytes: 412_000 }
	},
	{
		minutesAgo: 58,
		kind: 'text',
		source: 'Notion',
		html: true,
		title: 'Release notes',
		text: `Release notes, v0.4

• Pinboards keep their order across restarts
• Search understands app: and is: filters
• Hold Shift to paste without formatting`
	},
	{
		minutesAgo: 95,
		kind: 'code',
		source: 'Terminal',
		boards: ['snippets'],
		text: 'npm run build && npx electron-builder --mac --publish never'
	},
	{
		minutesAgo: 140,
		kind: 'color',
		source: 'Figma',
		text: 'rgb(16 185 129)',
		color: 'rgb(16 185 129)',
		boards: ['brand']
	},
	{
		minutesAgo: 190,
		kind: 'link',
		source: 'Google Chrome',
		text: 'https://github.com/you/openpaste/pull/142',
		url: 'https://github.com/you/openpaste/pull/142'
	},
	{
		minutesAgo: 60 * 20,
		kind: 'file',
		source: 'Finder',
		files: ['/Users/alex/Documents/Invoices/Invoice-2026-10.pdf']
	},
	{
		minutesAgo: 60 * 22,
		kind: 'text',
		source: 'Mail',
		boards: ['replies'],
		text: 'Thanks for the quick turnaround — this looks great. Merging once CI is green.'
	},
	{
		minutesAgo: 60 * 26,
		kind: 'image',
		source: 'Photos',
		image: { url: landscape, width: 1600, height: 1000, bytes: 1_840_000 }
	},
	{
		minutesAgo: 60 * 30,
		kind: 'code',
		source: 'DataGrip',
		boards: ['snippets'],
		text: `SELECT id, email, created_at
FROM users
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 50;`
	},
	{
		minutesAgo: 60 * 31,
		kind: 'color',
		source: 'Figma',
		text: 'hsl(24 95% 53%)',
		color: 'hsl(24 95% 53%)',
		boards: ['brand']
	},
	{
		minutesAgo: 60 * 45,
		kind: 'file',
		source: 'Finder',
		boards: ['brand'],
		files: [
			'/Users/alex/Design/OpenPaste/logo.svg',
			'/Users/alex/Design/OpenPaste/logo@2x.png',
			'/Users/alex/Design/OpenPaste/brand-guide.pdf'
		]
	},
	{
		minutesAgo: 60 * 50,
		kind: 'code',
		source: 'Visual Studio Code',
		text: `{
  "shortcut": "CommandOrControl+Shift+V",
  "historyDays": 30,
  "pasteDirectly": true
}`
	},
	{
		minutesAgo: 60 * 70,
		kind: 'text',
		source: 'Notes',
		text: `Standup
- Shelf opens on the screen under the pointer
- Fix: images pasted into Slack lost transparency
- Next: sync pinboards between machines?`
	},
	{
		minutesAgo: 60 * 75,
		kind: 'image',
		source: 'Figma',
		image: { url: uiMock, width: 900, height: 600, bytes: 96_000 }
	},
	{
		minutesAgo: 60 * 96,
		kind: 'code',
		source: 'Visual Studio Code',
		boards: ['snippets'],
		text: `def chunked(items, size):
    """Yield successive chunks of a list."""
    for i in range(0, len(items), size):
        yield items[i:i + size]`
	},
	{
		minutesAgo: 60 * 120,
		kind: 'link',
		source: 'Mail',
		text: 'mailto:hello@example.com',
		url: 'mailto:hello@example.com'
	},
	{
		minutesAgo: 60 * 150,
		kind: 'text',
		source: 'Slack',
		boards: ['replies'],
		text: 'On it — will have a draft to you by end of day.'
	}
]

export function buildSamples(now: number): {
	items: ClipItem[]
	payloads: Map<string, ClipPayload>
} {
	const payloads = new Map<string, ClipPayload>()
	const items = SAMPLES.map((s, index): ClipItem => {
		const id = `demo-${index}`
		const at = now - s.minutesAgo * 60_000
		const text = s.text ?? ''
		if (s.text)
			payloads.set(id, { text: s.text, html: s.html ? `<p>${s.text}</p>` : undefined })
		return {
			id,
			kind: s.kind,
			hash: `demo:${index}`,
			createdAt: at,
			usedAt: at,
			source: { name: s.source, color: APP_COLORS[s.source] },
			title: s.title,
			preview: s.files
				? s.files.map((f) => f.split('/').pop()).join('\n')
				: s.image
					? `Image ${s.image.width}×${s.image.height}`
					: text,
			size: s.files?.length ?? s.image?.bytes ?? text.length,
			lines: text.split('\n').length,
			rich: s.html || undefined,
			image: s.image
				? {
						file: s.image.url,
						thumb: s.image.url,
						width: s.image.width,
						height: s.image.height,
						bytes: s.image.bytes
					}
				: undefined,
			files: s.files,
			url: s.url,
			color: s.color,
			pinboards: s.boards ?? []
		}
	})
	return { items, payloads }
}
