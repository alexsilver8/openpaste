import { describe, expect, it } from 'vitest'
import { checkTitle } from '../scripts/check-pr-title.mjs'
import { GITMOJIS } from '../scripts/gitmojis.mjs'

describe('checkTitle', () => {
	it.each([
		'🔧 chore: switch from npm to pnpm',
		'🐛 fix(shelf): float over full-screen apps without switching Spaces',
		'💄 style(settings): make the top strip draggable',
		'♻️ refactor(store): split payloads from the index',
		'⬆️ build: upgrade Electron to 45',
		'🧑‍💻 chore(dev): add a debug flag',
		'💥 feat(api)!: rename the paste channel',
		'⏪️ revert: undo the shelf animation',
		'⚡️ perf(capture): hash images once',
		'⚡ perf(capture): hash images once'
	])('accepts %s', (title) => {
		expect(checkTitle(title)).toMatchObject({ ok: true })
	})

	it('accepts every official gitmoji', () => {
		const rejected = GITMOJIS.filter((g) => !checkTitle(`${g.emoji} chore: try ${g.code}`).ok)
		expect(rejected).toEqual([])
	})

	it('returns the parts', () => {
		expect(checkTitle('🐛 fix(shelf): keep focus')).toEqual({
			ok: true,
			emoji: '🐛',
			gitmoji: ':bug:',
			type: 'fix',
			scope: 'shelf',
			breaking: false,
			summary: 'keep focus'
		})
	})

	it.each([
		['', 'empty'],
		['fix: no emoji', 'Start the title with a gitmoji'],
		['🐛fix: no space', 'Start the title with a gitmoji'],
		['🐛  fix: two spaces', 'Start the title with a gitmoji'],
		['🦄 feat: unicorn', "🦄 isn't a gitmoji"],
		['😀 fix: smiley', "😀 isn't a gitmoji"],
		['🍕 chore: pizza', "🍕 isn't a gitmoji"],
		[' 🐛 fix: leading space', 'Remove the spaces'],
		['🐛 fix no colon', 'After the gitmoji'],
		['🐛 fix:no space after colon', 'After the gitmoji'],
		['🐛 Fix: capital type', 'After the gitmoji'],
		['🐛 fix(Shelf): capital scope', 'After the gitmoji'],
		['🐛 fix: ', 'Remove the spaces'],
		['🐛 bugfix: unknown type', '"bugfix" isn\'t a known type'],
		['🐛 fix: ends with a period.', 'full stop'],
		[':bug: fix: shortcode instead of emoji', 'Use the emoji itself (🐛) rather than :bug:'],
		[':unicorn: feat: unknown shortcode', 'Start the title with a gitmoji'],
		['👷 cicheck pull request titles', 'After the gitmoji']
	])('rejects %j', (title, message) => {
		const result = checkTitle(title)
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.error).toContain(message)
	})
})
