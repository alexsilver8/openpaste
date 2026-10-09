import { describe, expect, it } from 'vitest'
import { checkTitle } from '../scripts/check-pr-title.mjs'

describe('checkTitle', () => {
  it.each([
    '🔧 chore: switch from npm to pnpm',
    '🐛 fix(shelf): float over full-screen apps without switching Spaces',
    '💄 style(settings): make the top strip draggable',
    '♻️ refactor(store): split payloads from the index',
    '⬆️ build: upgrade Electron to 45',
    '🧑‍💻 chore(dev): add a debug flag',
    '💥 feat(api)!: rename the paste channel',
    '⏪️ revert: undo the shelf animation'
  ])('accepts %s', (title) => {
    expect(checkTitle(title)).toMatchObject({ ok: true })
  })

  it('returns the parts', () => {
    expect(checkTitle('🐛 fix(shelf): keep focus')).toEqual({
      ok: true,
      emoji: '🐛',
      type: 'fix',
      scope: 'shelf',
      breaking: false,
      summary: 'keep focus'
    })
  })

  it.each([
    ['', 'empty'],
    ['fix: no emoji', 'Start the title with an emoji'],
    ['🐛fix: no space', 'Start the title with an emoji'],
    ['🐛  fix: two spaces', 'Start the title with an emoji'],
    [' 🐛 fix: leading space', 'Remove the spaces'],
    ['🐛 fix no colon', 'After the emoji'],
    ['🐛 fix:no space after colon', 'After the emoji'],
    ['🐛 Fix: capital type', 'After the emoji'],
    ['🐛 fix(Shelf): capital scope', 'After the emoji'],
    ['🐛 fix: ', 'Remove the spaces'],
    ['🐛 bugfix: unknown type', '"bugfix" isn\'t a known type'],
    ['🐛 fix: ends with a period.', 'full stop'],
    [':bug: fix: shortcode instead of emoji', 'Start the title with an emoji']
  ])('rejects %j', (title, message) => {
    const result = checkTitle(title)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(message)
  })
})
