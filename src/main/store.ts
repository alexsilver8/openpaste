import { EventEmitter } from 'node:events'
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { classifyText, summarizeText } from '@shared/classify'
import { queryItems, searchKey } from '@shared/search'
import type {
	ClipImage,
	ClipItem,
	ClipKind,
	ClipPayload,
	ItemPatch,
	Pinboard,
	QueryOptions,
	SourceApp
} from '@shared/types'

/** What the capture pipeline hands the store for a fresh copy. */
export interface NewClip {
	kind: ClipKind
	hash: string
	preview: string
	size: number
	lines?: number
	rich?: boolean
	source?: SourceApp
	payload?: ClipPayload
	image?: ClipImage
	files?: string[]
	url?: string
	color?: string
}

export interface RetentionPolicy {
	historyLimit: number
	historyDays: number
}

interface IndexFile {
	version: 1
	items: ClipItem[]
	boards: Pinboard[]
}

const DAY = 24 * 60 * 60 * 1000
const UNDO_WINDOW = 10_000

/**
 * Clipboard history on disk:
 *
 *   <dir>/history.json     index of items and pinboards (small, loaded at startup)
 *   <dir>/payloads/<id>.json  full text/html/rtf for each item, read on demand
 *   <dir>/images/          full-size PNGs and thumbnails
 *
 * Emits `changed` when items change and `boards` when pinboards change.
 */
export class HistoryStore extends EventEmitter {
	private items = new Map<string, ClipItem>()
	private byHash = new Map<string, string>()
	private boards: Pinboard[] = []
	private keys = new Map<string, string>()
	private trash: { item: ClipItem; timer: NodeJS.Timeout }[] = []
	private saveTimer: NodeJS.Timeout | null = null
	private readonly now: () => number

	readonly payloadDir: string
	readonly imageDir: string
	readonly iconDir: string

	constructor(
		readonly dir: string,
		options: { now?: () => number } = {}
	) {
		super()
		this.now = options.now ?? Date.now
		this.payloadDir = join(dir, 'payloads')
		this.imageDir = join(dir, 'images')
		this.iconDir = join(dir, 'icons')
		for (const d of [dir, this.payloadDir, this.imageDir, this.iconDir])
			mkdirSync(d, { recursive: true })
	}

	// ── Persistence ────────────────────────────────────────────────────────

	load(): void {
		const file = join(this.dir, 'history.json')
		if (!existsSync(file)) return
		try {
			const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<IndexFile>
			this.boards = (data.boards ?? []).filter(
				(b): b is Pinboard => !!b && typeof b.id === 'string' && typeof b.name === 'string'
			)
			const boardIds = new Set(this.boards.map((b) => b.id))
			for (const item of data.items ?? []) {
				if (!item || typeof item.id !== 'string' || typeof item.hash !== 'string') continue
				item.pinboards = (item.pinboards ?? []).filter((id) => boardIds.has(id))
				this.items.set(item.id, item)
				this.byHash.set(item.hash, item.id)
			}
		} catch (error) {
			// A corrupt index shouldn't take the app down. Keep a copy for recovery and start fresh.
			console.error('[openpaste] could not read history, starting fresh:', error)
			try {
				renameSync(file, join(this.dir, `history.corrupt-${this.now()}.json`))
			} catch {
				/* ignore */
			}
		}
	}

	/** Writes the index now. Uses write-then-rename so a crash never leaves a half-written file. */
	saveNow(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer)
			this.saveTimer = null
		}
		const data: IndexFile = { version: 1, items: [...this.items.values()], boards: this.boards }
		const file = join(this.dir, 'history.json')
		const tmp = `${file}.tmp`
		writeFileSync(tmp, JSON.stringify(data))
		renameSync(tmp, file)
	}

	private scheduleSave(): void {
		if (this.saveTimer) return
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null
			try {
				this.saveNow()
			} catch (error) {
				console.error('[openpaste] failed to save history:', error)
			}
		}, 400)
	}

	/** Flushes pending writes and purges anything waiting in the undo buffer. */
	close(): void {
		for (const entry of this.trash) {
			clearTimeout(entry.timer)
			this.deleteFiles(entry.item)
		}
		this.trash = []
		this.saveNow()
	}

	/** Removes payload and image files that no longer belong to any item. */
	sweepOrphans(): number {
		const keep = new Set<string>()
		for (const item of [...this.items.values(), ...this.trash.map((t) => t.item)]) {
			keep.add(`${item.id}.json`)
			if (item.image) {
				keep.add(item.image.file)
				keep.add(item.image.thumb)
			}
		}
		let removed = 0
		for (const dir of [this.payloadDir, this.imageDir]) {
			for (const name of readdirSync(dir)) {
				if (!keep.has(name)) {
					rmSync(join(dir, name), { force: true })
					removed++
				}
			}
		}

		return removed
	}

	// ── Reading ────────────────────────────────────────────────────────────

	get size(): number {
		return this.items.size
	}

	get(id: string): ClipItem | undefined {
		return this.items.get(id)
	}

	findByHash(hash: string): ClipItem | undefined {
		const id = this.byHash.get(hash)

		return id ? this.items.get(id) : undefined
	}

	getPayload(id: string): ClipPayload | null {
		const item = this.items.get(id)
		if (!item) return null
		try {
			return JSON.parse(
				readFileSync(join(this.payloadDir, `${id}.json`), 'utf8')
			) as ClipPayload
		} catch {
			// Older or partial items: fall back to what the index knows.
			if (item.kind === 'file') return { text: item.files?.join('\n') }

			return item.kind === 'image' ? null : { text: item.preview }
		}
	}

	query(options: QueryOptions): ClipItem[] {
		return queryItems(this.items.values(), options, (item) => {
			let key = this.keys.get(item.id)
			if (key === undefined) {
				key = searchKey(item)
				this.keys.set(item.id, key)
			}

			return key
		})
	}

	listBoards(): Pinboard[] {
		return [...this.boards]
	}

	// ── Writing ────────────────────────────────────────────────────────────

	/**
	 * Records a copy. If identical content is already in history, that item moves to
	 * the front (and picks up the newest formatting/source) instead of duplicating.
	 */
	add(clip: NewClip): { item: ClipItem; isNew: boolean } {
		const now = this.now()
		const existing = this.findByHash(clip.hash)
		if (existing) {
			existing.usedAt = now
			if (clip.source) existing.source = clip.source
			if (clip.payload && (clip.rich || !existing.rich)) {
				this.writePayload(existing.id, clip.payload)
				existing.rich = clip.rich || undefined
			}
			this.keys.delete(existing.id)
			this.changed()

			return { item: existing, isNew: false }
		}

		const item: ClipItem = {
			id: randomUUID(),
			kind: clip.kind,
			hash: clip.hash,
			createdAt: now,
			usedAt: now,
			source: clip.source,
			preview: clip.preview,
			size: clip.size,
			lines: clip.lines,
			rich: clip.rich || undefined,
			image: clip.image,
			files: clip.files,
			url: clip.url,
			color: clip.color,
			pinboards: []
		}
		if (clip.payload) this.writePayload(item.id, clip.payload)
		this.items.set(item.id, item)
		this.byHash.set(item.hash, item.id)
		this.changed()

		return { item, isNew: true }
	}

	/** Moves an item to the front of history (after it was pasted or copied again). */
	touch(id: string): void {
		const item = this.items.get(id)
		if (!item) return
		item.usedAt = this.now()
		this.changed()
	}

	update(id: string, patch: ItemPatch): ClipItem | undefined {
		const item = this.items.get(id)
		if (!item) return undefined
		if (patch.title !== undefined) {
			const title = patch.title?.trim().slice(0, 120)
			item.title = title || undefined
		}
		if (typeof patch.text === 'string' && item.kind !== 'image' && item.kind !== 'file') {
			// Editing turns the item into plain text; formatting can't survive arbitrary edits.
			const text = patch.text
			const cls = classifyText(text, item.source?.name)
			const { preview, size, lines } = summarizeText(text)
			this.byHash.delete(item.hash)
			item.hash = `t:edited:${randomUUID()}`
			this.byHash.set(item.hash, item.id)
			Object.assign(item, {
				kind: cls.kind,
				preview,
				size,
				lines,
				url: cls.url,
				color: cls.color
			})
			item.rich = undefined
			this.writePayload(item.id, { text })
		}
		this.keys.delete(id)
		this.changed()

		return item
	}

	/** Deletes an item, keeping it restorable via `undoRemove` for a few seconds. */
	remove(id: string): boolean {
		const item = this.items.get(id)
		if (!item) return false
		this.detach(item)
		const timer = setTimeout(() => {
			this.trash = this.trash.filter((t) => t.item !== item)
			this.deleteFiles(item)
		}, UNDO_WINDOW)
		timer.unref?.()
		this.trash.push({ item, timer })
		this.changed()

		return true
	}

	undoRemove(): ClipItem | null {
		const entry = this.trash.pop()
		if (!entry) return null
		clearTimeout(entry.timer)
		const { item } = entry
		const boardIds = new Set(this.boards.map((b) => b.id))
		item.pinboards = item.pinboards.filter((b) => boardIds.has(b))
		this.items.set(item.id, item)
		// If the same content was copied again meanwhile, keep the restored one as canonical.
		const dupe = this.findByHash(item.hash)
		if (dupe && dupe.id !== item.id) this.purge(dupe)
		this.byHash.set(item.hash, item.id)
		this.changed()

		return item
	}

	setPinned(id: string, boardId: string, pinned: boolean): void {
		const item = this.items.get(id)
		if (!item || !this.boards.some((b) => b.id === boardId)) return
		const has = item.pinboards.includes(boardId)
		if (pinned && !has) item.pinboards = [...item.pinboards, boardId]
		else if (!pinned && has) item.pinboards = item.pinboards.filter((b) => b !== boardId)
		else return
		this.changed()
	}

	createBoard(input: { name: string; color: string }): Pinboard {
		const board: Pinboard = {
			id: randomUUID(),
			name: input.name.trim().slice(0, 40) || 'Pinboard',
			color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : '#6366f1',
			createdAt: this.now()
		}
		this.boards.push(board)
		this.boardsChanged()

		return board
	}

	updateBoard(id: string, patch: { name?: string; color?: string }): void {
		const board = this.boards.find((b) => b.id === id)
		if (!board) return
		if (typeof patch.name === 'string' && patch.name.trim())
			board.name = patch.name.trim().slice(0, 40)
		if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color))
			board.color = patch.color
		this.boardsChanged()
	}

	/** Deletes a pinboard. Its items stay in history and become subject to retention again. */
	deleteBoard(id: string): void {
		const before = this.boards.length
		this.boards = this.boards.filter((b) => b.id !== id)
		if (this.boards.length === before) return
		for (const item of this.items.values()) {
			if (item.pinboards.includes(id)) item.pinboards = item.pinboards.filter((b) => b !== id)
		}
		this.boardsChanged()
		this.changed()
	}

	/** Applies the retention policy. Pinned items are always kept. Returns how many were removed. */
	prune(policy: RetentionPolicy): number {
		const now = this.now()
		const unpinned = [...this.items.values()]
			.filter((i) => i.pinboards.length === 0)
			.sort((a, b) => b.usedAt - a.usedAt)
		const doomed = new Set<ClipItem>()
		if (policy.historyDays > 0) {
			const cutoff = now - policy.historyDays * DAY
			for (const item of unpinned) if (item.usedAt < cutoff) doomed.add(item)
		}
		if (policy.historyLimit > 0 && unpinned.length > policy.historyLimit) {
			for (const item of unpinned.slice(policy.historyLimit)) doomed.add(item)
		}
		for (const item of doomed) this.purge(item)
		if (doomed.size) this.changed()

		return doomed.size
	}

	clear(options: { keepPinned: boolean }): void {
		for (const item of [...this.items.values()]) {
			if (options.keepPinned && item.pinboards.length > 0) continue
			this.purge(item)
		}
		if (!options.keepPinned) {
			this.boards = []
			this.boardsChanged()
		}
		this.changed()
	}

	// ── Internals ──────────────────────────────────────────────────────────

	private writePayload(id: string, payload: ClipPayload): void {
		const clean: ClipPayload = {}
		if (payload.text) clean.text = payload.text
		if (payload.html) clean.html = payload.html
		if (payload.rtf) clean.rtf = payload.rtf
		writeFileSync(join(this.payloadDir, `${id}.json`), JSON.stringify(clean))
	}

	private detach(item: ClipItem): void {
		this.items.delete(item.id)
		this.keys.delete(item.id)
		if (this.byHash.get(item.hash) === item.id) this.byHash.delete(item.hash)
	}

	private purge(item: ClipItem): void {
		this.detach(item)
		this.deleteFiles(item)
	}

	private deleteFiles(item: ClipItem): void {
		const files = [join(this.payloadDir, `${item.id}.json`)]
		if (item.image) {
			// Images are content-addressed; another item may share them after an undo.
			const shared = [...this.items.values()].some((i) => i.image?.file === item.image?.file)
			if (!shared)
				files.push(
					join(this.imageDir, item.image.file),
					join(this.imageDir, item.image.thumb)
				)
		}
		for (const f of files) {
			try {
				unlinkSync(f)
			} catch {
				/* already gone */
			}
		}
	}

	private changed(): void {
		this.scheduleSave()
		this.emit('changed')
	}

	private boardsChanged(): void {
		this.scheduleSave()
		this.emit('boards')
	}
}
