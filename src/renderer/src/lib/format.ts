const number = new Intl.NumberFormat()

export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
	return `${number.format(n)} ${n === 1 ? singular : plural}`
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB']
	let value = bytes / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit++
	}

	return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "Just now", "4 min ago", "3 h ago", "Yesterday", "Tuesday", "12 Mar". */
export function relativeTime(timestamp: number, now = Date.now()): string {
	const diff = now - timestamp
	if (diff < 45_000) return 'Just now'
	if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))} min ago`
	const then = new Date(timestamp)
	const today = new Date(now)
	today.setHours(0, 0, 0, 0)
	if (then >= today) return `${Math.round(diff / HOUR)} h ago`
	if (then.getTime() >= today.getTime() - DAY) return 'Yesterday'
	if (diff < 6 * DAY) return then.toLocaleDateString(undefined, { weekday: 'long' })
	const sameYear = then.getFullYear() === new Date(now).getFullYear()

	return then.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		...(sameYear ? {} : { year: 'numeric' })
	})
}

export function absoluteTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	})
}

export function hostOf(url: string): { host: string; rest: string } {
	try {
		const u = new URL(url)
		if (u.protocol === 'mailto:') return { host: u.pathname, rest: 'Email address' }
		const rest = `${u.pathname === '/' ? '' : u.pathname}${u.search}${u.hash}`

		return { host: u.hostname.replace(/^www\./, '') || u.protocol, rest: decodeURI(rest) }
	} catch {
		return { host: url, rest: '' }
	}
}

export function fileName(path: string): string {
	return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

export function fileExtension(path: string): string {
	const name = fileName(path)
	const dot = name.lastIndexOf('.')

	return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}
