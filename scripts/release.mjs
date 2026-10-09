/**
 * `pnpm release`: prepares the next release of OpenPaste.
 *
 * 1. Reads the pull requests merged since the last release. Each is a squash commit whose
 *    message is the PR title, like "✨ feat(search): filter by app (#12)".
 * 2. Picks the next version: a "!" makes it major, any feat minor, anything else a patch.
 * 3. Adds a section to CHANGELOG.md and bumps the version in package.json.
 * 4. Opens a release pull request and turns on auto-merge. When its checks pass it merges, and
 *    the Release workflow builds the installers and publishes the GitHub release.
 *
 * Usage: pnpm release [patch|minor|major|<version>] [--dry-run] [--yes]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { checkTitle } from './check-pr-title.mjs'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
export const BUMPS = ['patch', 'minor', 'major']

/**
 * @typedef {{ title: string, pr?: number, type: string, scope?: string, breaking: boolean, summary: string }} Change
 */

/**
 * Parses a squash-merge commit subject, like "🐛 fix(shelf): keep focus (#9)".
 * Subjects that don't follow the title format still show up, under "other".
 *
 * @param {string} subject
 * @returns {Change}
 */
export function parseCommit(subject) {
	const ref = /\s\(#(\d+)\)$/.exec(subject)
	const title = ref ? subject.slice(0, ref.index) : subject
	const pr = ref ? Number(ref[1]) : undefined
	const result = checkTitle(title)
	if (!result.ok) return { title, pr, type: 'other', breaking: false, summary: title }
	const { type, scope, breaking, summary } = result
	return { title, pr, type, scope, breaking, summary }
}

/** True for the version bumps `pnpm release` makes, like "🔖 chore(release): v1.2.0". */
export const isReleaseCommit = (/** @type {Change} */ change) =>
	change.type === 'chore' && change.scope === 'release' && /^v\d+\.\d+\.\d+$/.test(change.summary)

/**
 * @param {Change[]} changes
 * @returns {'major' | 'minor' | 'patch'}
 */
export function bumpFor(changes) {
	if (changes.some((c) => c.breaking)) return 'major'
	if (changes.some((c) => c.type === 'feat')) return 'minor'
	return 'patch'
}

/** @param {string} version */
function parseVersion(version) {
	const m = SEMVER.exec(version)
	if (!m) throw new Error(`"${version}" isn't a version like 1.2.3.`)
	return m.slice(1).map(Number)
}

/** @param {string} a @param {string} b */
export function compareVersions(a, b) {
	const [x, y] = [parseVersion(a), parseVersion(b)]
	for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
	return 0
}

/**
 * @param {string} current
 * @param {string} bump "patch", "minor", "major", or an exact version
 */
export function nextVersion(current, bump) {
	if (SEMVER.test(bump)) {
		if (compareVersions(bump, current) <= 0) {
			throw new Error(`${bump} isn't newer than the current version, ${current}.`)
		}
		return bump
	}
	const [major, minor, patch] = parseVersion(current)
	if (bump === 'major') return `${major + 1}.0.0`
	if (bump === 'minor') return `${major}.${minor + 1}.0`
	if (bump === 'patch') return `${major}.${minor}.${patch + 1}`
	throw new Error(`Use patch, minor, major or a version like 1.2.3, not "${bump}".`)
}

/** Changelog sections in order. Each change goes in the first section that matches it. */
export const SECTIONS = /** @type {{ title: string, match: (c: Change) => boolean }[]} */ ([
	{ title: '💥 Breaking changes', match: (c) => c.breaking },
	{ title: '✨ New features', match: (c) => c.type === 'feat' },
	{ title: '🐛 Fixes', match: (c) => c.type === 'fix' },
	{ title: '⚡️ Performance', match: (c) => c.type === 'perf' },
	{ title: '💄 Look and feel', match: (c) => c.type === 'style' },
	{ title: '📝 Documentation', match: (c) => c.type === 'docs' },
	{ title: '🔧 Maintenance', match: () => true }
])

/**
 * Renders the changelog section for a release.
 *
 * @param {{ version: string, date: string, changes: Change[], repoUrl?: string }} options
 */
export function renderSection({ version, date, changes, repoUrl }) {
	const lines = [`## ${version} (${date})`, '']
	const remaining = [...changes]
	for (const section of SECTIONS) {
		const picked = remaining.filter(section.match)
		if (!picked.length) continue
		for (const change of picked) remaining.splice(remaining.indexOf(change), 1)
		lines.push(`### ${section.title}`, '')
		for (const c of picked) {
			const scope = c.scope ? `**${c.scope}:** ` : ''
			const link = c.pr
				? repoUrl
					? ` ([#${c.pr}](${repoUrl}/pull/${c.pr}))`
					: ` (#${c.pr})`
				: ''
			lines.push(`- ${scope}${c.summary}${link}`)
		}
		lines.push('')
	}
	return lines.join('\n').trimEnd() + '\n'
}

/**
 * Adds a release section above the newest one in CHANGELOG.md.
 *
 * @param {string} changelog
 * @param {string} section
 */
export function insertSection(changelog, section) {
	const at = changelog.search(/^## /m)
	if (at === -1) return `${changelog.trimEnd()}\n\n${section}`
	return `${changelog.slice(0, at)}${section}\n${changelog.slice(at)}`
}

/**
 * Returns the body of one version's changelog section, without its heading.
 *
 * @param {string} changelog
 * @param {string} version
 * @returns {string | null}
 */
export function extractReleaseNotes(changelog, version) {
	const escaped = version.replace(/\./g, '\\.')
	const heading = new RegExp(`^## ${escaped}(?: .*)?$`, 'm')
	const match = heading.exec(changelog)
	if (!match) return null
	const rest = changelog.slice(match.index + match[0].length)
	const next = rest.search(/^## /m)
	return (next === -1 ? rest : rest.slice(0, next)).trim()
}

/** Sets the version in package.json text without reformatting anything else. */
export function setPackageVersion(text, version) {
	const updated = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`)
	if (updated === text) throw new Error('Could not find the version in package.json.')
	return updated
}

// ── Command line ───────────────────────────────────────────────────────────

class ReleaseError extends Error {}

/** @param {string} file @param {string[]} args */
function run(file, args, options = {}) {
	return execFileSync(file, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		...options
	}).trim()
}

const git = (...args) => run('git', args)
const gh = (...args) => run('gh', args)

function tagExists(tag) {
	try {
		git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`)
		return true
	} catch {
		return false
	}
}

function repoUrlFrom(pkg) {
	const candidates = [
		pkg.homepage,
		pkg.repository?.url,
		typeof pkg.repository === 'string' ? pkg.repository : ''
	]
	for (const value of candidates) {
		const m = /github\.com[/:]([^/]+\/[^/.#]+)/.exec(value ?? '')
		if (m) return `https://github.com/${m[1]}`
	}
	return undefined
}

async function confirm(question) {
	if (!process.stdin.isTTY) {
		throw new ReleaseError('Add --yes to release without being asked (no terminal to ask in).')
	}
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	try {
		return /^y(es)?$/i.test((await rl.question(question)).trim())
	} finally {
		rl.close()
	}
}

export async function main(argv = process.argv.slice(2), log = console.log) {
	const dryRun = argv.includes('--dry-run')
	const yes = argv.includes('--yes') || argv.includes('-y')
	const requested = argv.find((a) => !a.startsWith('-'))
	if (requested && !BUMPS.includes(requested) && !SEMVER.test(requested)) {
		throw new ReleaseError(
			`Use patch, minor, major or a version like 1.2.3, not "${requested}".`
		)
	}

	if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') {
		throw new ReleaseError('Switch to main first: git switch main')
	}
	if (git('status', '--porcelain', '--untracked-files=no')) {
		throw new ReleaseError('You have uncommitted changes. Commit or stash them first.')
	}
	try {
		gh('auth', 'status')
	} catch {
		throw new ReleaseError('Log in to the GitHub CLI first: gh auth login')
	}

	log('Updating main…')
	git('pull', '--ff-only', '--quiet', 'origin', 'main')
	git('fetch', '--tags', '--quiet', 'origin')

	const pkgText = readFileSync('package.json', 'utf8')
	const pkg = JSON.parse(pkgText)
	const current = pkg.version
	const lastTag = `v${current}`
	if (!tagExists(lastTag)) {
		throw new ReleaseError(
			`package.json is at ${current}, but ${lastTag} hasn't been released yet. ` +
				'Check the Release workflow in GitHub Actions and finish that release first.'
		)
	}

	const subjects = git('log', `${lastTag}..HEAD`, '--first-parent', '--format=%s')
	const changes = subjects
		.split('\n')
		.filter(Boolean)
		.map(parseCommit)
		.filter((c) => !isReleaseCommit(c))
	if (!changes.length) {
		log(`Nothing to release: no pull requests merged since ${lastTag}.`)
		return { released: false }
	}

	const bump = requested ?? bumpFor(changes)
	const version = nextVersion(current, bump)
	const tag = `v${version}`
	if (tagExists(tag)) throw new ReleaseError(`${tag} already exists.`)

	const openReleasePrs = JSON.parse(
		gh('pr', 'list', '--state', 'open', '--json', 'number,headRefName')
	).filter((/** @type {{ headRefName: string }} */ p) => p.headRefName.startsWith('release/'))
	if (openReleasePrs.length) {
		throw new ReleaseError(
			`Release PR #${openReleasePrs[0].number} is still open. Merge or close it first.`
		)
	}

	const date = new Date().toISOString().slice(0, 10)
	const section = renderSection({ version, date, changes, repoUrl: repoUrlFrom(pkg) })
	const how = SEMVER.test(bump) ? 'as requested' : `${bump}${requested ? ', as requested' : ''}`
	log(
		`\nOpenPaste ${current} → ${version} (${how}), ${changes.length} change${changes.length === 1 ? '' : 's'}:\n`
	)
	log(section)

	if (dryRun) {
		log('Dry run: nothing was changed.')
		return { released: false, version }
	}
	if (!yes && !(await confirm(`Open a release PR for ${tag}? (y/N) `))) {
		log('Cancelled.')
		return { released: false, version }
	}

	const branch = `release/${tag}`
	const title = `🔖 chore(release): ${tag}`
	git('switch', '--quiet', '-c', branch)
	let committed = false
	let pushed = false
	try {
		writeFileSync('package.json', setPackageVersion(pkgText, version))
		writeFileSync('CHANGELOG.md', insertSection(readFileSync('CHANGELOG.md', 'utf8'), section))
		git('add', 'package.json', 'CHANGELOG.md')
		git('commit', '--quiet', '-m', title)
		committed = true
		log(`Pushing ${branch}…`)
		git('push', '--quiet', '-u', 'origin', branch)
		pushed = true
	} catch (error) {
		// Leave the repository as it was: main checked out, no half-made release branch.
		if (!committed) git('checkout', '--', 'package.json', 'CHANGELOG.md')
		git('switch', '--quiet', 'main')
		if (!pushed) git('branch', '--quiet', '-D', branch)
		throw error
	}
	git('switch', '--quiet', 'main')

	const notes = extractReleaseNotes(section, version) ?? ''
	const body = [
		`Releases OpenPaste ${version}. When this merges, the Release workflow builds the installers and publishes the release.`,
		'',
		notes
	].join('\n')
	const url = gh(
		'pr',
		'create',
		'--base',
		'main',
		'--head',
		branch,
		'--title',
		title,
		'--body',
		body
	)

	let autoMerge = true
	try {
		gh('pr', 'merge', url, '--auto', '--squash')
	} catch {
		autoMerge = false
	}

	log(`\nRelease PR: ${url}`)
	log(
		autoMerge
			? `It merges by itself once its checks pass. Then GitHub builds and publishes ${tag}.`
			: `Auto-merge isn't on for this repository, so merge it once its checks pass. Then GitHub builds and publishes ${tag}.`
	)
	return { released: true, version, url, autoMerge }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		const message =
			error instanceof ReleaseError
				? error.message
				: error.stderr?.toString().trim() || error.message
		console.error(`\n✖ ${message}`)
		process.exitCode = 1
	})
}
