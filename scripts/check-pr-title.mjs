#!/usr/bin/env node
/**
 * Checks a pull request title against the project's format:
 *
 *   <gitmoji> <type>(<scope>): <summary>
 *
 * For example "🐛 fix(shelf): keep focus in the app you were using". The emoji must be one of
 * the official gitmojis (https://gitmoji.dev) and the scope is optional.
 * Pull requests are squash-merged with the title as the commit message, so this keeps the
 * history on main in the same format.
 *
 * Usage: PR_TITLE="✨ feat: add pinboards" node scripts/check-pr-title.mjs
 */
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { GITMOJIS } from './gitmojis.mjs'

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

// Any emoji, including ones with a variation selector (♻️) or joined with ZWJ (🧑‍💻). Matching any
// emoji first lets the check say "that emoji isn't a gitmoji" rather than a vaguer error.
const EMOJI = String.raw`\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*`
const LEADING_EMOJI = new RegExp(String.raw`^(${EMOJI}) (?! )`, 'u')
const LEADING_SHORTCODE = /^(:[a-z0-9_+-]+:)/

// Compare without the invisible variation selector (U+FE0F), so "⚡" and "⚡️" both count.
const normalize = (/** @type {string} */ emoji) => emoji.replace(/\uFE0F/g, '')
const GITMOJI_BY_EMOJI = new Map(GITMOJIS.map((g) => [normalize(g.emoji), g]))
const GITMOJI_BY_CODE = new Map(GITMOJIS.map((g) => [g.code, g]))

const HEADER = /^([a-z]+)(?:\(([a-z0-9][a-z0-9-]*)\))?(!)?: (\S.*)$/

/**
 * @param {string} title
 * @returns {{ ok: true, emoji: string, gitmoji: string, type: string, scope?: string, breaking: boolean, summary: string }
 *   | { ok: false, error: string }}
 */
export function checkTitle(title) {
  if (!title || !title.trim()) return { ok: false, error: 'The title is empty.' }
  if (title !== title.trim()) {
    return { ok: false, error: 'Remove the spaces at the start or end of the title.' }
  }

  const emoji = LEADING_EMOJI.exec(title)
  if (!emoji) {
    const shortcode = LEADING_SHORTCODE.exec(title)?.[1]
    const known = shortcode && GITMOJI_BY_CODE.get(shortcode)
    if (known) {
      return {
        ok: false,
        error: `Use the emoji itself (${known.emoji}) rather than ${known.code}, since the title becomes a commit message and codes stay as text there.`
      }
    }
    return {
      ok: false,
      error: 'Start the title with a gitmoji and a single space, like "✨ feat: …".'
    }
  }

  const gitmoji = GITMOJI_BY_EMOJI.get(normalize(emoji[1]))
  if (!gitmoji) {
    return {
      ok: false,
      error: `${emoji[1]} isn't a gitmoji. Pick one from https://gitmoji.dev, like ✨ for a feature, 🐛 for a fix or 🔧 for configuration.`
    }
  }

  const rest = title.slice(emoji[0].length)
  const header = HEADER.exec(rest)
  if (!header) {
    return {
      ok: false,
      error:
        'After the gitmoji, write a lowercase type, an optional scope in brackets, a colon and a space, like "fix: …" or "fix(shelf): …".'
    }
  }

  const [, type, scope, breaking, summary] = header
  if (!TYPES.includes(type)) {
    return { ok: false, error: `"${type}" isn't a known type. Use one of: ${TYPES.join(', ')}.` }
  }
  if (summary.endsWith('.')) {
    return { ok: false, error: 'Leave the full stop off the end of the summary.' }
  }

  return {
    ok: true,
    emoji: emoji[1],
    gitmoji: gitmoji.code,
    type,
    scope,
    breaking: !!breaking,
    summary
  }
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
    `\nTitle:    ${title}\nProblem:  ${result.error}\n\nFormat:   <gitmoji> <type>(<scope>): <summary>`
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
        'Format: `<gitmoji> <type>(<scope>): <summary>`. The emoji must come from [gitmoji.dev](https://gitmoji.dev) and the scope is optional. Examples:',
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
