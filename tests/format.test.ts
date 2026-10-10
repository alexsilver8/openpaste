import { describe, expect, it } from 'vitest'
import { hostOf } from '@renderer/lib/format'

describe('hostOf', () => {
	it('keeps the real host when the path has a % that is not an escape', () => {
		expect(hostOf('https://shop.example.com/sale-50%')).toEqual({
			host: 'shop.example.com',
			rest: '/sale-50%'
		})
	})

	it('still decodes valid escapes in the path', () => {
		expect(hostOf('https://example.com/caf%C3%A9')).toEqual({
			host: 'example.com',
			rest: '/café'
		})
	})
})
