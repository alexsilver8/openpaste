import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import type { WinHelper } from './win-helper'

/** The app in front, as far as the OS will tell us. */
export interface AppInfo {
	name: string
	id?: string
	/** App bundle (macOS) or executable (Windows), used to fetch the icon. */
	path?: string
	pid?: number
	/** Window handle (Windows) or X11 window id (Linux), used to refocus before pasting. */
	window?: string
}

export function run(file: string, args: string[], timeout = 1500): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			file,
			args,
			{ timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
			(error, stdout) => (error ? reject(error) : resolve(stdout.toString()))
		)
	})
}

/** Parses `lsappinfo info <ASN>` output (macOS). Exported for tests. */
export function parseLsappinfo(output: string): AppInfo | null {
	const name = /^"(.+?)"\s+ASN:/m.exec(output)?.[1]
	if (!name) return null
	return {
		name,
		id: /bundleID="([^"]+)"/.exec(output)?.[1],
		path: /bundle path="([^"]+)"/.exec(output)?.[1],
		pid: Number(/\bpid\s*=\s*(\d+)/.exec(output)?.[1]) || undefined
	}
}

const JXA_FRONT = `ObjC.import('AppKit');
var a = $.NSWorkspace.sharedWorkspace.frontmostApplication;
JSON.stringify({ name: a.localizedName.js, id: a.bundleIdentifier.js, path: a.bundleURL.path.js, pid: a.processIdentifier })`

async function frontMac(): Promise<AppInfo | null> {
	try {
		const asn = (await run('lsappinfo', ['front'])).trim()
		if (asn) {
			const info = parseLsappinfo(await run('lsappinfo', ['info', asn]))
			if (info) return info
		}
	} catch {
		/* fall through to JXA */
	}
	try {
		return JSON.parse(await run('osascript', ['-l', 'JavaScript', '-e', JXA_FRONT])) as AppInfo
	} catch {
		return null
	}
}

/** Parses `xprop -id <win> WM_CLASS _NET_WM_PID` output (Linux/X11). Exported for tests. */
export function parseXprop(output: string): { className?: string; pid?: number } {
	const cls = /WM_CLASS\([^)]*\)\s*=\s*"([^"]*)"(?:,\s*"([^"]*)")?/.exec(output)
	const pid = /_NET_WM_PID\([^)]*\)\s*=\s*(\d+)/.exec(output)
	return { className: cls?.[2] || cls?.[1], pid: pid ? Number(pid[1]) : undefined }
}

async function frontLinux(): Promise<AppInfo | null> {
	if (!process.env.DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland') return null
	try {
		const root = await run('xprop', ['-root', '_NET_ACTIVE_WINDOW'])
		const window = /window id # (0x[0-9a-f]+)/i.exec(root)?.[1]
		if (!window || window === '0x0') return null
		const { className, pid } = parseXprop(
			await run('xprop', ['-id', window, 'WM_CLASS', '_NET_WM_PID'])
		)
		let name = className
		if (!name && pid) name = (await readFile(`/proc/${pid}/comm`, 'utf8')).trim()
		if (!name) return null
		return { name, id: className?.toLowerCase(), pid, window }
	} catch {
		return null
	}
}

export async function getFrontmostApp(helper: WinHelper | null): Promise<AppInfo | null> {
	switch (process.platform) {
		case 'darwin':
			return frontMac()
		case 'win32': {
			const app = await helper?.front()
			return app
				? {
						name: app.name,
						id: app.id,
						path: app.path ?? undefined,
						pid: app.pid,
						window: app.window
					}
				: null
		}
		default:
			return frontLinux()
	}
}
