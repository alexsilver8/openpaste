import { EventEmitter } from 'node:events'
import {
	getText,
	imageType,
	readImageBuffer,
	readState,
	sha1,
	type ClipboardState
} from './clipboard-io'

const TEXT_TYPES = ['text/plain', 'text/uri-list']

export interface ChangeEvent {
	state: ClipboardState
	/** Already-read image bytes, so the capture step doesn't fetch them twice. */
	imageBuffer?: Buffer | null
}

/**
 * Polls the clipboard and emits `change` when its content changes.
 *
 * There's no cross-platform "clipboard changed" event, so every tick compares
 * a cheap signature (available types + text hash). Image-only clipboards are
 * expensive to read on some platforms, so their content is re-hashed on a slower
 * cadence unless something forces a check (like opening the shelf).
 *
 * An optional `changeToken` (e.g. Windows' clipboard sequence number) lets a
 * platform skip reading entirely when nothing changed.
 */
export class ClipboardWatcher extends EventEmitter {
	private timer: NodeJS.Timeout | null = null
	private lastSignature: string | null = null
	private lastImageHash: string | null = null
	private lastImageCheck = 0
	private lastToken: string | null = null
	private queue: Promise<unknown> = Promise.resolve()

	constructor(
		private readonly options: {
			interval?: number
			imageInterval?: number
			changeToken?: () => Promise<string | null>
		} = {}
	) {
		super()
	}

	start(): void {
		if (this.timer) return
		// Baseline on start: whatever is on the clipboard now isn't a new copy.
		this.exclusive(() => this.check({ baselineOnly: true }))
		this.timer = setInterval(() => {
			this.tick()
		}, this.options.interval ?? 500)
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = null
	}

	/** Checks right away, including image content. */
	checkNow(): Promise<void> {
		return this.exclusive(() => this.check({ forceImage: true }))
	}

	/**
	 * Runs a clipboard write without recording it as a new copy: the write and
	 * the re-baseline happen while polling is paused.
	 */
	writeQuietly(write: () => Promise<void>): Promise<void> {
		return this.exclusive(async () => {
			await write()
			await this.check({ baselineOnly: true, forceImage: true })
		})
	}

	private tick(): Promise<void> {
		return this.exclusive(() => this.check({}))
	}

	private exclusive<T>(task: () => Promise<T>): Promise<T> {
		const run = this.queue.then(task, task)
		this.queue = run.catch(() => undefined)

		return run
	}

	private async check(opts: { baselineOnly?: boolean; forceImage?: boolean }): Promise<void> {
		try {
			let tokenChanged = false
			if (this.options.changeToken) {
				const token = await this.options.changeToken().catch(() => null)
				if (token !== null) {
					tokenChanged = this.lastToken !== null && token !== this.lastToken
					const unchanged = token === this.lastToken
					this.lastToken = token
					if (unchanged && !opts.forceImage && !opts.baselineOnly) return
				}
			}

			const state = await readState()
			let signature = [...state.types].sort().join('|')
			for (const type of TEXT_TYPES) {
				if (state.types.includes(type)) {
					signature += `#${sha1((await getText(state, type)) ?? '')}`
					break
				}
			}

			let imageBuffer: Buffer | null | undefined
			const imageOnly = !!imageType(state) && !TEXT_TYPES.some((t) => state.types.includes(t))
			if (imageOnly) {
				const now = Date.now()
				const due =
					opts.forceImage ||
					now - this.lastImageCheck >= (this.options.imageInterval ?? 1500)
				if (due || signature !== this.lastSignature) {
					this.lastImageCheck = now
					imageBuffer = await readImageBuffer(state)
					this.lastImageHash = imageBuffer ? sha1(imageBuffer) : null
				}
				signature += `#img:${this.lastImageHash ?? ''}`
			}

			// A changed token with identical content means the same thing was copied
			// again; report it so the item moves back to the front.
			if (signature === this.lastSignature && !tokenChanged) return
			const first = this.lastSignature === null
			this.lastSignature = signature
			if (opts.baselineOnly || first) return
			this.emit('change', { state, imageBuffer } satisfies ChangeEvent)
		} catch (error) {
			// The clipboard can be briefly locked by another app (common on Windows). Try again next tick.
			if (process.env.OPENPASTE_DEBUG)
				console.warn('[openpaste] clipboard read failed:', error)
		}
	}
}
