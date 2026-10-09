/**
 * Prints one version's notes from CHANGELOG.md, for the body of its GitHub release.
 *
 * Usage: node scripts/release-notes.mjs 1.2.0
 */
import { readFileSync } from 'node:fs'
import { extractReleaseNotes } from './release.mjs'

const version = process.argv[2]
if (!version) {
	console.error('Usage: node scripts/release-notes.mjs <version>')
	process.exit(1)
}
const notes = extractReleaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version)
process.stdout.write(`${notes || `OpenPaste ${version}. See CHANGELOG.md for what changed.`}\n`)
