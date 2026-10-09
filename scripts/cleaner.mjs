/**
 * `pnpm cleaner`: checks the code against the conventions in CONTRIBUTING.md that Prettier and
 * TypeScript don't enforce.
 *
 * Each rule picks the files it applies to and reports what breaks the convention, with the file,
 * line and how to fix it. The command exits with an error when it reports anything.
 *
 * Usage:
 *   pnpm cleaner             check every file in src/renderer/src
 *   pnpm cleaner <file>...   check only these files
 */
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** Where the React components live. */
export const RENDERER = 'src/renderer/src'

/** A component file is named after its folder, like `card/card.tsx`. */
export function isComponentFile(path) {
	return path.endsWith('.tsx') && basename(path, '.tsx') === basename(dirname(path))
}

/**
 * The conventions to check. Each rule has an id (shown with every problem), the files it applies
 * to, and a check that returns `{ node, message }` for each problem in a parsed file.
 */
export const RULES = [
	{
		id: 'no-types-in-components',
		description: 'Component files declare no interfaces or types',
		appliesTo: isComponentFile,
		check(sourceFile, path) {
			const props = `${basename(path, '.tsx')}.props.ts`
			const problems = []
			const visit = (node) => {
				if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
					const kind = ts.isInterfaceDeclaration(node) ? 'interface' : 'type'
					problems.push({
						node,
						message: `Component files can't declare types: move ${kind} ${node.name.text} out of this file (props types go in ${props}).`
					})
				}
				ts.forEachChild(node, visit)
			}
			visit(sourceFile)

			return problems
		}
	}
]

/**
 * Checks one file's source against every rule that applies to it.
 *
 * @param {string} path the file's path, with forward slashes
 * @param {string} text the file's contents
 * @returns {{ path: string, line: number, column: number, rule: string, message: string }[]}
 */
export function checkFile(path, text) {
	const rules = RULES.filter((rule) => rule.appliesTo(path))
	if (!rules.length) return []
	const sourceFile = ts.createSourceFile(
		path,
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX
	)

	return rules.flatMap((rule) =>
		rule.check(sourceFile, path).map(({ node, message }) => {
			const { line, character } = sourceFile.getLineAndCharacterOfPosition(
				node.getStart(sourceFile)
			)

			return { path, line: line + 1, column: character + 1, rule: rule.id, message }
		})
	)
}

/** Every file under `dir`, as paths relative to the working directory with forward slashes. */
export function listFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return listFiles(path)

		return [relative(process.cwd(), path).split(sep).join('/')]
	})
}

function main() {
	const args = process.argv.slice(2)
	const paths = args.length ? args.map((p) => p.split(sep).join('/')) : listFiles(RENDERER)
	const problems = paths.flatMap((path) => checkFile(path, readFileSync(path, 'utf8')))

	for (const p of problems) {
		console.log(`${p.path}:${p.line}:${p.column}  ${p.message}  (${p.rule})`)
		if (process.env.GITHUB_ACTIONS) {
			console.log(
				`::error file=${p.path},line=${p.line},col=${p.column},title=${p.rule}::${p.message}`
			)
		}
	}
	if (!problems.length) {
		console.log(`No problems in ${paths.length} files.`)

		return
	}
	const files = new Set(problems.map((p) => p.path)).size
	console.log(
		`\n${problems.length} problem${problems.length === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}.`
	)
	process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
