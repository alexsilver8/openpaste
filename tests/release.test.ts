import { describe, expect, it } from 'vitest'
import {
  bumpFor,
  extractReleaseNotes,
  insertSection,
  isReleaseCommit,
  nextVersion,
  parseCommit,
  renderSection,
  setPackageVersion
} from '../scripts/release.mjs'

describe('parseCommit', () => {
  it('reads a squash-merge subject', () => {
    expect(parseCommit('🐛 fix(shelf): keep focus (#9)')).toEqual({
      title: '🐛 fix(shelf): keep focus',
      pr: 9,
      type: 'fix',
      scope: 'shelf',
      breaking: false,
      summary: 'keep focus'
    })
  })

  it('keeps commits that do not follow the title format, as "other"', () => {
    expect(parseCommit('pilot')).toMatchObject({ type: 'other', summary: 'pilot', pr: undefined })
  })

  it('spots release commits', () => {
    expect(isReleaseCommit(parseCommit('🔖 chore(release): v1.0.0 (#6)'))).toBe(true)
    expect(isReleaseCommit(parseCommit('🔧 chore: switch from npm to pnpm (#1)'))).toBe(false)
    expect(isReleaseCommit(parseCommit('🔧 chore(release): add a release command (#8)'))).toBe(
      false
    )
  })
})

describe('versions', () => {
  const changes = (...titles: string[]) => titles.map(parseCommit)

  it('picks the bump from the changes', () => {
    expect(bumpFor(changes('🐛 fix: a (#1)', '📝 docs: b (#2)'))).toBe('patch')
    expect(bumpFor(changes('🐛 fix: a (#1)', '✨ feat: b (#2)'))).toBe('minor')
    expect(bumpFor(changes('✨ feat: a (#1)', '💥 feat(api)!: b (#2)'))).toBe('major')
  })

  it('computes the next version', () => {
    expect(nextVersion('1.4.2', 'patch')).toBe('1.4.3')
    expect(nextVersion('1.4.2', 'minor')).toBe('1.5.0')
    expect(nextVersion('1.4.2', 'major')).toBe('2.0.0')
    expect(nextVersion('1.4.2', '1.6.0')).toBe('1.6.0')
  })

  it('refuses versions that go backwards or are malformed', () => {
    expect(() => nextVersion('1.4.2', '1.4.2')).toThrow("isn't newer")
    expect(() => nextVersion('1.4.2', '1.3.9')).toThrow("isn't newer")
    expect(() => nextVersion('1.4.2', 'huge')).toThrow('Use patch, minor, major')
  })
})

describe('changelog', () => {
  const section = renderSection({
    version: '1.1.0',
    date: '2026-10-20',
    repoUrl: 'https://github.com/alexsilver8/openpaste',
    changes: [
      '✨ feat(search): filter by source app (#12)',
      '🐛 fix: keep focus after pasting (#13)',
      '💥 refactor(store)!: new history format (#14)',
      '👷 ci: cache the pnpm store (#15)',
      'tidy up'
    ].map(parseCommit)
  })

  it('groups changes under headings with links', () => {
    expect(section).toBe(
      [
        '## 1.1.0 (2026-10-20)',
        '',
        '### 💥 Breaking changes',
        '',
        '- **store:** new history format ([#14](https://github.com/alexsilver8/openpaste/pull/14))',
        '',
        '### ✨ New features',
        '',
        '- **search:** filter by source app ([#12](https://github.com/alexsilver8/openpaste/pull/12))',
        '',
        '### 🐛 Fixes',
        '',
        '- keep focus after pasting ([#13](https://github.com/alexsilver8/openpaste/pull/13))',
        '',
        '### 🔧 Maintenance',
        '',
        '- cache the pnpm store ([#15](https://github.com/alexsilver8/openpaste/pull/15))',
        '- tidy up',
        ''
      ].join('\n')
    )
  })

  const changelog = [
    '# Changelog',
    '',
    'All notable changes.',
    '',
    '## 1.0.0',
    '',
    'The first release.',
    ''
  ].join('\n')

  it('inserts the newest section above the older ones', () => {
    const updated = insertSection(changelog, section)
    expect(updated.indexOf('## 1.1.0')).toBeGreaterThan(updated.indexOf('All notable changes.'))
    expect(updated.indexOf('## 1.1.0')).toBeLessThan(updated.indexOf('## 1.0.0'))
    expect(updated.startsWith('# Changelog\n\nAll notable changes.\n\n## 1.1.0')).toBe(true)
  })

  it('extracts one version for the release notes', () => {
    const updated = insertSection(changelog, section)
    const notes = extractReleaseNotes(updated, '1.1.0')!
    expect(notes.startsWith('### 💥 Breaking changes')).toBe(true)
    expect(notes).not.toContain('## 1.0.0')
    expect(extractReleaseNotes(updated, '1.0.0')).toBe('The first release.')
    expect(extractReleaseNotes(updated, '1.0')).toBeNull()
    expect(extractReleaseNotes(updated, '9.9.9')).toBeNull()
  })
})

describe('setPackageVersion', () => {
  it('changes only the version', () => {
    const text =
      '{\n  "name": "openpaste",\n  "version": "1.0.0",\n  "dependencies": { "x": "1.0.0" }\n}\n'
    expect(setPackageVersion(text, '1.1.0')).toBe(
      text.replace('"version": "1.0.0"', '"version": "1.1.0"')
    )
  })
})
