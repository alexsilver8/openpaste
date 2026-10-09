import { describe, expect, it } from 'vitest'
import { classifyText, detectColor, detectUrl, kindLabel, looksLikeCode, summarizeText } from '@shared/classify'

describe('detectColor', () => {
  it.each([
    ['#fff', '#fff'],
    ['#5B4CF5', '#5b4cf5'],
    ['  #00000080 ', '#00000080'],
    ['rgb(255, 0, 0)', 'rgb(255, 0, 0)'],
    ['rgb(16 185 129)', 'rgb(16 185 129)'],
    ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)'],
    ['hsl(24 95% 53%)', 'hsl(24 95% 53%)'],
    ['hsl(210deg 40% 50% / 0.8)', 'hsl(210deg 40% 50% / 0.8)'],
    ['oklch(0.7 0.15 250)', 'oklch(0.7 0.15 250)']
  ])('recognizes %s', (input, expected) => {
    expect(detectColor(input)).toBe(expected)
  })

  it.each(['#ggg', '#12345', 'red and blue', 'rgb(1,2)', 'color: #fff', '#fff\n#000'])(
    'rejects %s',
    (input) => {
      expect(detectColor(input)).toBeNull()
    }
  )
})

describe('detectUrl', () => {
  it('accepts single links', () => {
    expect(detectUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c')
    expect(detectUrl(' http://localhost:3000 ')).toBe('http://localhost:3000')
    expect(detectUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com')
    expect(detectUrl('file:///Users/me/notes.txt')).toBe('file:///Users/me/notes.txt')
  })

  it('adds https to bare www hosts', () => {
    expect(detectUrl('www.example.org/path')).toBe('https://www.example.org/path')
  })

  it('rejects text that merely contains a link', () => {
    expect(detectUrl('see https://example.com')).toBeNull()
    expect(detectUrl('example.com')).toBeNull()
    expect(detectUrl('https://')).toBeNull()
  })
})

describe('looksLikeCode', () => {
  it('spots common code', () => {
    expect(looksLikeCode('const x = items.map((i) => i.id);')).toBe(true)
    expect(looksLikeCode('def chunked(items, size):\n    for i in range(0, len(items), size):\n        yield items[i:i + size]')).toBe(true)
    expect(looksLikeCode('SELECT id, email FROM users WHERE id = 1;')).toBe(true)
    expect(looksLikeCode('{"a": 1, "b": [true, null]}')).toBe(true)
    expect(looksLikeCode('npm install --save-dev vitest')).toBe(true)
  })

  it('leaves prose alone, even from an editor', () => {
    expect(looksLikeCode('Can we move the design review to Thursday? I will bring the new flow.')).toBe(false)
    expect(
      looksLikeCode(
        'This paragraph explains how the feature works and why we chose this approach over the alternatives.',
        'Visual Studio Code'
      )
    ).toBe(false)
  })

  it('uses the source app as a hint', () => {
    expect(looksLikeCode('git status', 'Terminal')).toBe(true)
  })
})

describe('classifyText', () => {
  it('orders color, link, code, text', () => {
    expect(classifyText('#ff8800')).toEqual({ kind: 'color', color: '#ff8800' })
    expect(classifyText('https://example.com')).toEqual({ kind: 'link', url: 'https://example.com' })
    expect(classifyText('let a = 1;').kind).toBe('code')
    expect(classifyText('Hello there').kind).toBe('text')
  })
})

describe('summarizeText', () => {
  it('counts characters and lines', () => {
    expect(summarizeText('a\nb\nc')).toEqual({ preview: 'a\nb\nc', size: 5, lines: 3 })
  })
  it('caps the preview', () => {
    expect(summarizeText('x'.repeat(20_000)).preview.length).toBe(10_000)
  })
})

describe('kindLabel', () => {
  it('distinguishes rich text and multiple files', () => {
    expect(kindLabel({ kind: 'text', rich: true })).toBe('Rich Text')
    expect(kindLabel({ kind: 'file', files: ['a', 'b'] })).toBe('Files')
    expect(kindLabel({ kind: 'file', files: ['a'] })).toBe('File')
  })
})
