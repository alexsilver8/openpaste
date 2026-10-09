import { KIND_LABELS, kindLabel } from './classify'
import type { ClipItem, ClipKind, QueryOptions } from './types'

export interface ParsedQuery {
  terms: string[]
  kinds: ClipKind[]
  apps: string[]
}

const KIND_ALIASES: Record<string, ClipKind> = {
  text: 'text',
  txt: 'text',
  link: 'link',
  links: 'link',
  url: 'link',
  image: 'image',
  images: 'image',
  img: 'image',
  picture: 'image',
  screenshot: 'image',
  color: 'color',
  colors: 'color',
  colour: 'color',
  code: 'code',
  snippet: 'code',
  file: 'file',
  files: 'file'
}

/**
 * Parses a search string. Supports filters alongside free text:
 *   `is:image`, `type:link`, `app:figma`, and quoted phrases ("exact words").
 */
export function parseQuery(input: string): ParsedQuery {
  const result: ParsedQuery = { terms: [], kinds: [], apps: [] }
  const tokens = input.match(/"[^"]*"|\S+/g) ?? []
  for (const raw of tokens) {
    const token = raw.startsWith('"') ? raw.slice(1, -1) : raw
    const filter = /^(is|type|kind|app|from):(.+)$/i.exec(raw)
    if (filter) {
      const [, key, value] = filter
      if (/^(is|type|kind)$/i.test(key)) {
        const kind = KIND_ALIASES[value.toLowerCase()]
        if (kind) {
          result.kinds.push(kind)
          continue
        }
      } else {
        result.apps.push(value.toLowerCase().replace(/^"|"$/g, ''))
        continue
      }
    }
    if (token) result.terms.push(token.toLowerCase())
  }
  return result
}

/** Builds the lowercase haystack an item is searched against. */
export function searchKey(item: ClipItem): string {
  return [
    item.title,
    item.preview,
    item.url,
    item.color,
    item.files?.join('\n'),
    item.source?.name,
    kindLabel(item),
    KIND_LABELS[item.kind]
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

export function matchesQuery(
  item: ClipItem,
  query: ParsedQuery,
  key: string = searchKey(item)
): boolean {
  if (query.kinds.length && !query.kinds.includes(item.kind)) return false
  if (query.apps.length) {
    const app = `${item.source?.name ?? ''} ${item.source?.id ?? ''}`.toLowerCase()
    if (!query.apps.every((a) => app.includes(a))) return false
  }
  return query.terms.every((t) => key.includes(t))
}

/**
 * Filters and sorts items the way the shelf shows them: most recently used first.
 * `keyFor` lets callers cache search keys between queries.
 */
export function queryItems(
  items: Iterable<ClipItem>,
  options: QueryOptions,
  keyFor: (item: ClipItem) => string = searchKey
): ClipItem[] {
  const parsed = parseQuery(options.search ?? '')
  const kind = options.kind && options.kind !== 'all' ? options.kind : null
  const out: ClipItem[] = []
  for (const item of items) {
    if (options.pinboard && !item.pinboards.includes(options.pinboard)) continue
    if (kind && item.kind !== kind) continue
    if (!matchesQuery(item, parsed, parsed.terms.length ? keyFor(item) : '')) continue
    out.push(item)
  }
  out.sort((a, b) => b.usedAt - a.usedAt)
  return options.limit && options.limit > 0 ? out.slice(0, options.limit) : out
}
