import { describe, expect, it } from 'vitest'
import { parseQuery, queryItems } from '@shared/search'
import type { ClipItem } from '@shared/types'

const item = (over: Partial<ClipItem>): ClipItem => ({
  id: over.id ?? Math.random().toString(36),
  kind: 'text',
  hash: Math.random().toString(36),
  createdAt: 0,
  usedAt: 0,
  preview: '',
  size: 0,
  pinboards: [],
  ...over
})

const items = [
  item({ id: 'a', preview: 'Quarterly report draft', usedAt: 3, source: { name: 'Slack' } }),
  item({ id: 'b', kind: 'link', preview: 'https://figma.com/file/1', url: 'https://figma.com/file/1', usedAt: 5, source: { name: 'Google Chrome' } }),
  item({ id: 'c', kind: 'image', preview: 'Image 10×10', usedAt: 1, source: { name: 'Figma' }, pinboards: ['brand'] }),
  item({ id: 'd', kind: 'color', preview: '#ff0000', color: '#ff0000', usedAt: 4, title: 'Brand red', pinboards: ['brand'] })
]

describe('parseQuery', () => {
  it('splits filters, phrases and terms', () => {
    expect(parseQuery('is:image app:Figma "exact words" Hello')).toEqual({
      terms: ['exact words', 'hello'],
      kinds: ['image'],
      apps: ['figma']
    })
  })
  it('treats unknown kinds as text', () => {
    expect(parseQuery('is:banana').terms).toEqual(['is:banana'])
  })
})

describe('queryItems', () => {
  it('sorts by last use, newest first', () => {
    expect(queryItems(items, {}).map((i) => i.id)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('matches every term, case-insensitively, across fields', () => {
    expect(queryItems(items, { search: 'REPORT' }).map((i) => i.id)).toEqual(['a'])
    expect(queryItems(items, { search: 'brand red' }).map((i) => i.id)).toEqual(['d'])
    expect(queryItems(items, { search: 'figma' }).map((i) => i.id)).toEqual(['b', 'c'])
  })
  it('filters by kind, app and pinboard', () => {
    expect(queryItems(items, { search: 'is:link' }).map((i) => i.id)).toEqual(['b'])
    expect(queryItems(items, { search: 'app:slack' }).map((i) => i.id)).toEqual(['a'])
    expect(queryItems(items, { kind: 'color' }).map((i) => i.id)).toEqual(['d'])
    expect(queryItems(items, { pinboard: 'brand' }).map((i) => i.id)).toEqual(['d', 'c'])
  })
  it('respects the limit', () => {
    expect(queryItems(items, { limit: 2 })).toHaveLength(2)
  })
})
