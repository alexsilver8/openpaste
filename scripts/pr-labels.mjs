/**
 * Labels a pull request from its title and assigns it to the person who opened it.
 *
 * The type in the title picks the label: "🐛 fix(shelf): …" gets `bug`, "✨ feat: …" gets
 * `enhancement`, and a "!" adds `breaking change`. When the title is edited, labels follow.
 * Labels are created the first time they're needed.
 *
 * Runs from .github/workflows/pr-labels.yml with GITHUB_TOKEN, GITHUB_REPOSITORY and
 * GITHUB_EVENT_PATH set by GitHub Actions.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { checkTitle } from './check-pr-title.mjs'

/** @typedef {{ name: string, color: string, description: string }} Label */

/** The label for each Conventional Commits type. The first three are GitHub's defaults. */
export const TYPE_LABELS = /** @type {Record<string, Label>} */ ({
	feat: { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
	fix: { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
	docs: {
		name: 'documentation',
		color: '0075ca',
		description: 'Improvements or additions to documentation'
	},
	style: { name: 'style', color: 'f9d0c4', description: 'UI or styling changes' },
	refactor: { name: 'refactor', color: 'c5def5', description: 'Code changes that keep behavior' },
	perf: { name: 'performance', color: 'fbca04', description: 'Faster or lighter' },
	test: { name: 'tests', color: 'bfd4f2', description: 'Adding or updating tests' },
	build: { name: 'build', color: '5319e7', description: 'Build, packaging or dependencies' },
	ci: { name: 'ci', color: '1d76db', description: 'GitHub Actions and checks' },
	chore: { name: 'chore', color: 'ededed', description: 'Tooling and maintenance' },
	revert: { name: 'revert', color: 'b60205', description: 'Undoes an earlier change' }
})

/** @type {Label} */
export const BREAKING_LABEL = {
	name: 'breaking change',
	color: 'e11d21',
	description: 'Changes behavior people rely on'
}

const MANAGED = new Set([...Object.values(TYPE_LABELS), BREAKING_LABEL].map((l) => l.name))

/**
 * Works out which labels a pull request should gain and lose for its title. Only labels this
 * script manages are ever removed.
 *
 * @param {string} title
 * @param {string[]} current label names already on the pull request
 * @returns {{ add: Label[], remove: string[] }}
 */
export function planLabels(title, current) {
	const result = checkTitle(title)
	/** @type {Label[]} */
	const wanted = []
	if (result.ok) {
		wanted.push(TYPE_LABELS[result.type])
		if (result.breaking) wanted.push(BREAKING_LABEL)
	}
	const wantedNames = new Set(wanted.map((l) => l.name))
	return {
		add: wanted.filter((l) => !current.includes(l.name)),
		remove: current.filter((name) => MANAGED.has(name) && !wantedNames.has(name))
	}
}

/**
 * @typedef {(method: string, path: string, body?: unknown) => Promise<{ status: number, data: any }>} Request
 */

/**
 * Applies labels and the assignee for one pull_request_target event.
 *
 * @param {{ event: any, repo: string, request: Request, log?: (line: string) => void }} options
 */
export async function run({ event, repo, request, log = console.log }) {
	const pr = event.pull_request
	if (!pr) return log('Not a pull request event; nothing to do.')
	const issue = `/repos/${repo}/issues/${pr.number}`
	const action = event.action

	// Edits to the description also fire "edited"; only a title change can change the labels.
	const titleChanged = action !== 'edited' || event.changes?.title !== undefined
	if (titleChanged) {
		const current = (pr.labels ?? []).map((/** @type {{ name: string }} */ l) => l.name)
		const { add, remove } = planLabels(pr.title, current)

		for (const name of remove) {
			const res = await request('DELETE', `${issue}/labels/${encodeURIComponent(name)}`)
			if (res.status >= 400 && res.status !== 404)
				throw new Error(`Removing "${name}" failed: ${res.status}`)
			log(`Removed label: ${name}`)
		}
		if (add.length) {
			for (const label of add) {
				// 422 means the label already exists, which is fine.
				const res = await request('POST', `/repos/${repo}/labels`, label)
				if (res.status >= 400 && res.status !== 422)
					throw new Error(`Creating "${label.name}" failed: ${res.status}`)
			}
			const res = await request('POST', `${issue}/labels`, { labels: add.map((l) => l.name) })
			if (res.status >= 400) throw new Error(`Adding labels failed: ${res.status}`)
			log(`Added labels: ${add.map((l) => l.name).join(', ')}`)
		}
		if (!add.length && !remove.length) log('Labels already match the title.')
	}

	const author = pr.user
	const isBot = author?.type === 'Bot' || author?.login?.endsWith('[bot]')
	if (
		(action === 'opened' || action === 'reopened') &&
		author &&
		!isBot &&
		!pr.assignees?.length
	) {
		const res = await request('POST', `${issue}/assignees`, { assignees: [author.login] })
		if (res.status >= 400) throw new Error(`Assigning ${author.login} failed: ${res.status}`)
		// GitHub quietly skips people who can't be assigned, such as some outside contributors.
		const assigned = (res.data?.assignees ?? []).some(
			(/** @type {{ login: string }} */ a) => a.login === author.login
		)
		log(
			assigned
				? `Assigned ${author.login}`
				: `Couldn't assign ${author.login}; GitHub doesn't allow it for this user.`
		)
	}
}

/** @returns {Request} */
function githubRequest(token, apiUrl = 'https://api.github.com') {
	return async (method, path, body) => {
		const res = await fetch(`${apiUrl}${path}`, {
			method,
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28',
				...(body ? { 'Content-Type': 'application/json' } : {})
			},
			body: body ? JSON.stringify(body) : undefined
		})
		const text = await res.text()
		let data = null
		try {
			data = text ? JSON.parse(text) : null
		} catch {
			data = text
		}
		return { status: res.status, data }
	}
}

async function main() {
	const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH, GITHUB_API_URL } = process.env
	if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_EVENT_PATH) {
		throw new Error(
			'Run this from GitHub Actions: GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_EVENT_PATH are required.'
		)
	}
	const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'))
	await run({
		event,
		repo: GITHUB_REPOSITORY,
		request: githubRequest(GITHUB_TOKEN, GITHUB_API_URL)
	})
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.log(`::error title=Pull request labels::${error.message}`)
		process.exitCode = 1
	})
}
