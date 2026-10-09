import { describe, expect, it } from 'vitest'
import { checkFile, isComponentFile } from '../scripts/cleaner.mjs'

const CARD = 'src/renderer/src/shelf/shelf-app/components/card/card.tsx'

describe('isComponentFile', () => {
	it.each([CARD, 'src/renderer/src/components/icon/icon.tsx'])('counts %s', (path) => {
		expect(isComponentFile(path)).toBe(true)
	})

	it.each([
		'src/renderer/src/shelf/shelf-app/components/card/card.props.ts',
		'src/renderer/src/shelf/shelf-app/components/card/card.utils.ts',
		'src/renderer/src/components/icon/icon.constants.tsx',
		'src/renderer/src/shelf/shelf-app/components/card/index.ts',
		'src/renderer/src/main.tsx',
		'src/renderer/src/lib/highlight.tsx'
	])('skips %s', (path) => {
		expect(isComponentFile(path)).toBe(false)
	})
})

describe('no-types-in-components', () => {
	it('flags interfaces and types anywhere in a component file', () => {
		const source = [
			"import type { CardProps } from './card.props'",
			'',
			'interface Hover {',
			'	x: number',
			'}',
			'',
			'const Card = (props: CardProps) => {',
			"	type Mode = 'a' | 'b'",
			'',
			'	return null',
			'}'
		].join('\n')

		expect(checkFile(CARD, source)).toEqual([
			expect.objectContaining({ line: 3, column: 1, rule: 'no-types-in-components' }),
			expect.objectContaining({ line: 8, column: 2, rule: 'no-types-in-components' })
		])
		expect(checkFile(CARD, source)[0].message).toContain('interface Hover')
		expect(checkFile(CARD, source)[0].message).toContain('card.props.ts')
	})

	it('allows type imports and inline type annotations', () => {
		const source = [
			"import { memo, useState, type MouseEvent } from 'react'",
			"import type { CardProps } from './card.props'",
			'',
			'const Card = (props: CardProps) => {',
			'	const [hover, setHover] = useState<{ x: number } | null>(null)',
			'	const onMove = (e: MouseEvent<HTMLDivElement>) => setHover({ x: e.clientX } as { x: number })',
			'',
			'	return <div onMouseMove={onMove}>{hover?.x}</div>',
			'}',
			'',
			'export default memo(Card)'
		].join('\n')

		expect(checkFile(CARD, source)).toEqual([])
	})

	it('leaves props files alone', () => {
		const source = 'export interface CardProps {\n\tselected: boolean\n}\n'

		expect(checkFile(CARD.replace('card.tsx', 'card.props.ts'), source)).toEqual([])
	})
})
