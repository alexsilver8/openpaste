import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryStore, type NewClip } from '../src/main/store'

let dir: string
let clock: number
let store: HistoryStore

const DAY = 86_400_000
const text = (value: string, extra: Partial<NewClip> = {}): NewClip => ({
	kind: 'text',
	hash: `t:${value}`,
	preview: value,
	size: value.length,
	payload: { text: value },
	...extra
})

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'openpaste-test-'))
	clock = 1_700_000_000_000
	store = new HistoryStore(dir, { now: () => clock })
})

afterEach(() => {
	rmSync(dir, { recursive: true, force: true })
})

describe('HistoryStore', () => {
	it('records copies newest first and de-duplicates repeats', () => {
		store.add(text('one'))
		clock += 1000
		store.add(text('two'))
		clock += 1000
		const again = store.add(text('one', { source: { name: 'Slack' } }))
		expect(again.isNew).toBe(false)
		expect(store.size).toBe(2)
		expect(store.query({}).map((i) => i.preview)).toEqual(['one', 'two'])
		expect(store.query({})[0].source?.name).toBe('Slack')
	})

	it('keeps richer formatting when the same text is copied plain', () => {
		const { item } = store.add(
			text('hi', { rich: true, payload: { text: 'hi', html: '<b>hi</b>' } })
		)
		store.add(text('hi'))
		expect(store.getPayload(item.id)).toEqual({ text: 'hi', html: '<b>hi</b>' })
		expect(store.get(item.id)?.rich).toBe(true)
	})

	it('stores payloads on disk and survives a reload', () => {
		const { item } = store.add(text('persist me'))
		const board = store.createBoard({ name: 'Work', color: '#0891b2' })
		store.setPinned(item.id, board.id, true)
		store.saveNow()

		const reloaded = new HistoryStore(dir)
		reloaded.load()
		expect(reloaded.size).toBe(1)
		expect(reloaded.listBoards()[0].name).toBe('Work')
		expect(reloaded.get(item.id)?.pinboards).toEqual([board.id])
		expect(reloaded.getPayload(item.id)).toEqual({ text: 'persist me' })
	})

	it('reclassifies edited text and drops formatting', () => {
		const { item } = store.add(
			text('hello', { rich: true, payload: { text: 'hello', html: '<i>hello</i>' } })
		)
		store.update(item.id, { text: 'https://example.com' })
		const edited = store.get(item.id)!
		expect(edited.kind).toBe('link')
		expect(edited.url).toBe('https://example.com')
		expect(edited.rich).toBeUndefined()
		expect(store.getPayload(item.id)).toEqual({ text: 'https://example.com' })
		store.update(item.id, { title: '  Docs  ' })
		expect(store.get(item.id)?.title).toBe('Docs')
		store.update(item.id, { title: null })
		expect(store.get(item.id)?.title).toBeUndefined()
	})

	it('can undo a delete', () => {
		const { item } = store.add(text('oops'))
		store.remove(item.id)
		expect(store.size).toBe(0)
		expect(store.undoRemove()?.id).toBe(item.id)
		expect(store.size).toBe(1)
		expect(store.getPayload(item.id)).toEqual({ text: 'oops' })
		expect(store.undoRemove()).toBeNull()
	})

	it('purges deleted files when closed', () => {
		const { item } = store.add(text('bye'))
		store.remove(item.id)
		store.close()
		expect(existsSync(join(dir, 'payloads', `${item.id}.json`))).toBe(false)
	})

	it('prunes by count and age but never touches pinned items', () => {
		const board = store.createBoard({ name: 'Keep', color: '#16a34a' })
		const old = store.add(text('ancient')).item
		store.setPinned(old.id, board.id, true)
		store.add(text('also old'))
		clock += 40 * DAY
		for (const v of ['a', 'b', 'c', 'd']) {
			clock += 1000
			store.add(text(v))
		}
		const removed = store.prune({ historyDays: 30, historyLimit: 3 })
		expect(removed).toBe(2) // "also old" by age, "a" by count
		expect(store.query({}).map((i) => i.preview)).toEqual(['d', 'c', 'b', 'ancient'])
	})

	it('deleting a pinboard unpins its items but keeps them', () => {
		const board = store.createBoard({ name: 'Tmp', color: '#ca8a04' })
		const { item } = store.add(text('keep me'))
		store.setPinned(item.id, board.id, true)
		store.deleteBoard(board.id)
		expect(store.listBoards()).toEqual([])
		expect(store.get(item.id)?.pinboards).toEqual([])
	})

	it('clears history, optionally keeping pinboards', () => {
		const board = store.createBoard({ name: 'Keep', color: '#16a34a' })
		const pinned = store.add(text('pinned')).item
		store.setPinned(pinned.id, board.id, true)
		store.add(text('loose'))
		store.clear({ keepPinned: true })
		expect(store.query({}).map((i) => i.preview)).toEqual(['pinned'])
		store.clear({ keepPinned: false })
		expect(store.size).toBe(0)
		expect(store.listBoards()).toEqual([])
	})

	it('moves a corrupt index aside instead of crashing', () => {
		writeFileSync(join(dir, 'history.json'), '{ not json')
		const fresh = new HistoryStore(dir)
		fresh.load()
		expect(fresh.size).toBe(0)
		expect(readdirSync(dir).some((f) => f.startsWith('history.corrupt-'))).toBe(true)
	})

	it('sweeps orphaned files', () => {
		store.add(text('real'))
		writeFileSync(join(dir, 'payloads', 'ghost.json'), '{}')
		writeFileSync(join(dir, 'images', 'ghost.png'), '')
		expect(store.sweepOrphans()).toBe(2)
		expect(readdirSync(join(dir, 'payloads'))).toHaveLength(1)
	})

	it('ignores pins to unknown boards', () => {
		const { item } = store.add(text('x'))
		store.setPinned(item.id, 'nope', true)
		expect(store.get(item.id)?.pinboards).toEqual([])
	})
})
