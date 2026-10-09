#!/usr/bin/env node
/**
 * Checks a pull request title against the project's format:
 *
 *   <emoji> <type>(<scope>): <summary>
 *
 * For example "🐛 fix(shelf): keep focus in the app you were using". The scope is optional.
 * Pull requests are squash-merged with the title as the commit message, so this keeps the
 * history on main in the same format.
 *
 * Usage: PR_TITLE="✨ feat: add pinboards" node scripts/check-pr-title.mjs
 */
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Conventional Commits types. */
export const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert'
]

export const EXAMPLES = [
  '✨ feat(search): filter by source app',
  '🐛 fix(shelf): keep focus in the app you were using',
  '🔧 chore: switch from npm to pnpm'
]

// One emoji, including ones with a variation selector (♻️) or joined with ZWJ (🧑‍💻).
const EMOJI = String.raw`\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*`
const LEADING_EMOJI = new RegExp(String.raw`^(${EMOJI}) (?! )`, 'u')
const HEADER = /^([a-z]+)(?:\(([a-z0-9][a-z0-9-]*)\))?(!)?: (\S.*)$/

/**
 * @param {string} title
 * @returns {{ ok: true, emoji: string, type: string, scope?: string, breaking: boolean, summary: string }
 *   | { ok: false, error: string }}
 */
export function checkTitle(title) {
  if (!title || !title.trim()) return { ok: false, error: 'The title is empty.' }
  if (title !== title.trim()) {
    return { ok: false, error: 'Remove the spaces at the start or end of the title.' }
  }

  const emoji = LEADING_EMOJI.exec(title)
  if (!emoji) {
    return {
      ok: false,
      error: 'Start the title with an emoji and a single space, like "✨ feat: …".'
    }
  }

  const rest = title.slice(emoji[0].length)
  const header = HEADER.exec(rest)
  if (!header) {
    return {
      ok: false,
      error:
        'After the emoji, write a lowercase type, an optional scope in brackets, a colon and a space, like "fix: …" or "fix(shelf): …".'
    }
  }

  const [, type, scope, breaking, summary] = header
  if (!TYPES.includes(type)) {
    return { ok: false, error: `"${type}" isn't a known type. Use one of: ${TYPES.join(', ')}.` }
  }
  if (summary.endsWith('.')) {
    return { ok: false, error: 'Leave the full stop off the end of the summary.' }
  }

  return { ok: true, emoji: emoji[1], type, scope, breaking: !!breaking, summary }
}

function main() {
  const title = process.env.PR_TITLE ?? ''
  const result = checkTitle(title)
  const summaryFile = process.env.GITHUB_STEP_SUMMARY

  if (result.ok) {
    console.log(`Title looks good: ${title}`)
    return
  }

  console.log(`::error title=Pull request title::${result.error}`)
  console.log(
    `\nTitle:    ${title}\nProblem:  ${result.error}\n\nFormat:   <emoji> <type>(<scope>): <summary>`
  )
  console.log(`Examples:\n${EXAMPLES.map((e) => `  ${e}`).join('\n')}`)
  if (summaryFile) {
    appendFileSync(
      summaryFile,
      [
        '### Pull request title needs a fix',
        '',
        `**Title:** ${title}`,
        '',
        `**Problem:** ${result.error}`,
        '',
        'Format: `<emoji> <type>(<scope>): <summary>` (the scope is optional). Examples:',
        '',
        ...EXAMPLES.map((e) => `- \`${e}\``),
        '',
        `Types: ${TYPES.map((t) => `\`${t}\``).join(', ')}`,
        '',
        'Edit the title and this check runs again.',
        ''
      ].join('\n')
    )
  }
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
