import { memo, useRef, type DragEvent, type MouseEvent } from 'react'
import { kindLabel } from '@shared/classify'
import type { ClipView, Pinboard, SourceApp } from '@shared/types'
import { KIND_COLORS, describeColor } from '../lib/colors'
import { fileExtension, fileName, formatBytes, formatCount, hostOf, relativeTime } from '../lib/format'
import { highlightCode, highlightMatches } from '../lib/highlight'
import { Icon } from '../lib/icons'
import { MOD } from '../env'

export const CARD_WIDTH = 232
export const CARD_GAP = 14

interface CardProps {
  item: ClipView
  index: number
  selected: boolean
  showHint: boolean
  /** Touch screens: tapping the already-selected card pastes it. */
  tapToPaste?: boolean
  boards: Pinboard[]
  terms: string[]
  now: number
  onSelect(index: number): void
  onActivate(index: number): void
  onMenu(index: number, event: MouseEvent): void
  onDragStart(index: number, event: DragEvent): void
}

function AppMark({ source, iconUrl }: { source?: SourceApp; iconUrl?: string }) {
  if (iconUrl) return <img className="app-mark" src={iconUrl} alt="" title={source?.name} draggable={false} />
  const letter = source?.name.trim().charAt(0).toUpperCase()
  return (
    <span className="app-mark app-mark--letter" title={source?.name}>
      {letter || <Icon name="paste" size={15} />}
    </span>
  )
}

function Body({ item, terms }: { item: ClipView; terms: string[] }) {
  switch (item.kind) {
    case 'image':
      return (
        <div className="card-image">
          {item.thumbUrl && <img src={item.thumbUrl} alt="" draggable={false} loading="lazy" decoding="async" />}
        </div>
      )
    case 'color': {
      const info = describeColor(item.color ?? item.preview)
      return (
        <div className="card-color" style={{ background: item.color, color: info?.ink }}>
          <span className="card-color-hex">{info?.hex ?? item.preview}</span>
          <span className="card-color-alt">{info?.rgb}</span>
        </div>
      )
    }
    case 'link': {
      const { host, rest } = hostOf(item.url ?? item.preview)
      return (
        <div className="card-link">
          <span className="card-link-host">{highlightMatches(host, terms)}</span>
          {rest && <span className="card-link-rest">{highlightMatches(rest, terms)}</span>}
        </div>
      )
    }
    case 'code':
      return (
        <pre className="card-code">
          <code>{terms.length ? highlightMatches(item.preview.slice(0, 900), terms) : highlightCode(item.preview.slice(0, 900))}</code>
        </pre>
      )
    case 'file': {
      const files = item.files ?? []
      if (files.length === 1) {
        const ext = fileExtension(files[0])
        return (
          <div className="card-file card-file--single">
            <span className="file-glyph">
              <Icon name="file" size={44} strokeWidth={1.1} />
              {ext && <span className="file-ext">{ext.slice(0, 4)}</span>}
            </span>
            <span className="card-file-name">{highlightMatches(fileName(files[0]), terms)}</span>
          </div>
        )
      }
      return (
        <ul className="card-file">
          {files.slice(0, 5).map((f) => (
            <li key={f}>
              <Icon name="file" size={14} />
              <span>{highlightMatches(fileName(f), terms)}</span>
            </li>
          ))}
          {files.length > 5 && <li className="card-file-more">{files.length - 5} more</li>}
        </ul>
      )
    }
    default:
      return <p className="card-text">{highlightMatches(item.preview.slice(0, 700), terms)}</p>
  }
}

function meta(item: ClipView): string {
  switch (item.kind) {
    case 'image':
      return item.image
        ? `${item.image.width} × ${item.image.height}, ${formatBytes(item.image.bytes)}`
        : 'Image'
    case 'file':
      return formatCount(item.size, 'file')
    case 'color':
      return item.color && !item.color.startsWith('#') ? item.color : 'Color'
    case 'code':
      return (item.lines ?? 1) > 1 ? formatCount(item.lines ?? 1, 'line') : formatCount(item.size, 'character')
    case 'link':
      return item.url?.startsWith('mailto:') ? 'Email address' : 'Web link'
    default:
      return formatCount(item.size, 'character')
  }
}

export const Card = memo(function Card({
  item,
  index,
  selected,
  showHint,
  tapToPaste,
  boards,
  terms,
  now,
  onSelect,
  onActivate,
  onMenu,
  onDragStart
}: CardProps) {
  const band = item.source?.color ?? KIND_COLORS[item.kind]
  const pinned = boards.filter((b) => item.pinboards.includes(b.id))
  const label = item.title || kindLabel(item)
  const wasSelected = useRef(false)
  return (
    <div
      id={`card-${item.id}`}
      role="option"
      aria-selected={selected}
      aria-label={`${label}, ${item.source?.name ?? 'unknown app'}, ${relativeTime(item.usedAt, now)}`}
      className={`card card--${item.kind}${selected ? ' is-selected' : ''}`}
      style={{ ['--band' as string]: band }}
      draggable
      onMouseDown={() => {
        wasSelected.current = selected
        onSelect(index)
      }}
      onClick={() => {
        if (tapToPaste && wasSelected.current) onActivate(index)
      }}
      onDoubleClick={() => onActivate(index)}
      onContextMenu={(e) => onMenu(index, e)}
      onDragStart={(e) => onDragStart(index, e)}
    >
      <header className="card-band">
        <span className="card-band-text">
          <span className="card-label">{label}</span>
          <span className="card-time">{relativeTime(item.usedAt, now)}</span>
        </span>
        <AppMark source={item.source} iconUrl={item.iconUrl} />
      </header>
      <div className={`card-body card-body--${item.kind}`}>
        <Body item={item} terms={terms} />
      </div>
      <footer className="card-foot">
        <span className="card-meta">{meta(item)}</span>
        <span className="card-foot-end">
          {pinned.map((b) => (
            <span key={b.id} className="board-dot" style={{ background: b.color }} title={b.name} />
          ))}
          {showHint && index < 9 && (
            <kbd className="quick-key">
              {MOD}
              {index + 1}
            </kbd>
          )}
        </span>
      </footer>
    </div>
  )
})
