import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

/**
 * A long-lived PowerShell process that answers small Win32 questions over stdin/stdout.
 * Spawning PowerShell per request costs ~300 ms; keeping one warm makes pasting instant.
 *
 * Protocol: one request per line, `<id> <command> [argument]`; one reply per line, `<id> <json>`.
 */
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OpenPasteNative {
	[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
	[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
	[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
	[DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
	[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
	public static void Paste(bool shift) {
		const uint UP = 2;
		// Release modifiers the user may still be holding so the target app sees a clean Ctrl+V.
		keybd_event(0x10, 0, UP, UIntPtr.Zero);
		keybd_event(0x12, 0, UP, UIntPtr.Zero);
		keybd_event(0x5B, 0, UP, UIntPtr.Zero);
		keybd_event(0x11, 0, 0, UIntPtr.Zero);
		if (shift) keybd_event(0x10, 0, 0, UIntPtr.Zero);
		keybd_event(0x56, 0, 0, UIntPtr.Zero);
		keybd_event(0x56, 0, UP, UIntPtr.Zero);
		if (shift) keybd_event(0x10, 0, UP, UIntPtr.Zero);
		keybd_event(0x11, 0, UP, UIntPtr.Zero);
	}
}
'@
[Console]::Out.WriteLine('ready')
while ($true) {
	$line = [Console]::In.ReadLine()
	if ($null -eq $line) { break }
	$parts = $line.Split(' ', 3)
	$id = $parts[0]
	$cmd = if ($parts.Length -gt 1) { $parts[1] } else { '' }
	$arg = if ($parts.Length -gt 2) { $parts[2] } else { '' }
	$out = 'null'
	try {
		switch ($cmd) {
			'seq' { $out = [string][OpenPasteNative]::GetClipboardSequenceNumber() }
			'front' {
				$h = [OpenPasteNative]::GetForegroundWindow()
				[uint32]$procId = 0
				[void][OpenPasteNative]::GetWindowThreadProcessId($h, [ref]$procId)
				$p = Get-Process -Id $procId
				$path = $null
				$desc = $null
				try { $path = $p.Path } catch {}
				try { $desc = $p.MainModule.FileVersionInfo.FileDescription } catch {}
				if (-not $desc) { $desc = $p.ProcessName }
				$out = ConvertTo-Json -Compress @{ name = $desc; id = $p.ProcessName; path = $path; pid = [int]$procId; window = [string]$h.ToInt64() }
			}
			'activate' { $out = ([OpenPasteNative]::SetForegroundWindow([IntPtr][long]$arg)).ToString().ToLower() }
			'paste' { [OpenPasteNative]::Paste($arg -eq 'shift'); $out = 'true' }
		}
	} catch { $out = 'null' }
	[Console]::Out.WriteLine("$id $out")
}
`

export interface WinFrontApp {
	name: string
	id: string
	path?: string | null
	pid: number
	window: string
}

export class WinHelper {
	private proc: ChildProcessWithoutNullStreams | null = null
	private pending = new Map<number, (value: string | null) => void>()
	private nextId = 1
	private restarts = 0
	private ready: Promise<boolean> = Promise.resolve(false)
	private disposed = false

	constructor(private readonly scriptDir: string) {}

	start(): void {
		if (this.disposed || this.proc) return
		const scriptPath = join(this.scriptDir, 'openpaste-helper.ps1')
		writeFileSync(scriptPath, SCRIPT, 'utf8')
		const proc = spawn(
			'powershell.exe',
			[
				'-NoLogo',
				'-NoProfile',
				'-NonInteractive',
				'-ExecutionPolicy',
				'Bypass',
				'-File',
				scriptPath
			],
			{ windowsHide: true, stdio: 'pipe' }
		)
		this.proc = proc
		let markReady: (ok: boolean) => void = () => {}
		this.ready = new Promise((resolve) => (markReady = resolve))
		const lines = createInterface({ input: proc.stdout })
		lines.on('line', (line) => {
			if (line === 'ready') return markReady(true)
			const space = line.indexOf(' ')
			const id = Number(line.slice(0, space))
			const resolve = this.pending.get(id)
			if (!resolve) return
			this.pending.delete(id)
			const value = line.slice(space + 1)
			resolve(value === 'null' ? null : value)
		})
		proc.stderr.on('data', (chunk) => {
			if (process.env.OPENPASTE_DEBUG) console.warn('[openpaste helper]', String(chunk))
		})
		proc.on('error', () => markReady(false))
		proc.on('exit', () => {
			markReady(false)
			this.proc = null
			for (const resolve of this.pending.values()) resolve(null)
			this.pending.clear()
			if (!this.disposed && this.restarts++ < 3) setTimeout(() => this.start(), 1000)
		})
	}

	private async request(command: string, arg = '', timeout = 1500): Promise<string | null> {
		if (!(await this.ready) || !this.proc) return null
		const id = this.nextId++

		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.pending.delete(id)
				resolve(null)
			}, timeout)
			this.pending.set(id, (value) => {
				clearTimeout(timer)
				resolve(value)
			})
			this.proc?.stdin.write(`${id} ${command} ${arg}\n`)
		})
	}

	sequence(): Promise<string | null> {
		return this.request('seq', '', 400)
	}

	async front(): Promise<WinFrontApp | null> {
		const raw = await this.request('front')
		if (!raw) return null
		try {
			return JSON.parse(raw) as WinFrontApp
		} catch {
			return null
		}
	}

	async activate(window: string): Promise<boolean> {
		if (!/^\d+$/.test(window)) return false

		return (await this.request('activate', window)) === 'true'
	}

	async paste(shift = false): Promise<boolean> {
		return (await this.request('paste', shift ? 'shift' : '')) === 'true'
	}

	dispose(): void {
		this.disposed = true
		this.proc?.kill()
		this.proc = null
	}
}
