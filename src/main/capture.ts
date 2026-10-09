import { existsSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app, type NativeImage } from 'electron'
import { classifyText, summarizeText } from '@shared/classify'
import { isIgnoredApp } from '@shared/settings'
import type { ClipImage, Settings } from '@shared/types'
import { readSnapshot, sha1 } from './clipboard-io'
import type { AppIcons } from './icons'
import { getFrontmostApp, type AppInfo } from './platform/frontmost'
import type { WinHelper } from './platform/win-helper'
import type { HistoryStore, NewClip } from './store'
import type { ChangeEvent } from './watcher'

/** Larger copies are skipped; they'd bloat the history and are rarely re-pasted. */
const MAX_TEXT_LENGTH = 8_000_000
const THUMB_MAX = { width: 560, height: 360 }

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
	])
}

export function isSelf(info: AppInfo | null): boolean {
	if (!info) return false

	return info.pid === process.pid || info.name === app.getName() || info.name === 'OpenPaste'
}

/** Turns clipboard changes into history items. */
export class CaptureService {
	constructor(
		private readonly deps: {
			store: HistoryStore
			icons: AppIcons
			helper: WinHelper | null
			settings: () => Settings
		}
	) {}

	async handle(event: ChangeEvent): Promise<void> {
		const settings = this.deps.settings()
		if (settings.paused) return

		let front = await withTimeout(getFrontmostApp(this.deps.helper), 800, null)
		if (isSelf(front)) front = null
		if (isIgnoredApp(front, settings.ignoredApps)) return

		const snapshot = await readSnapshot(event.state, {
			captureImages: settings.captureImages,
			captureFiles: settings.captureFiles,
			imageBuffer: event.imageBuffer
		})
		if (snapshot.concealed && settings.ignoreConcealed) return

		const source = front ? await this.deps.icons.toSource(front) : undefined
		let clip: NewClip | null = null

		if (snapshot.files?.length) {
			const files = snapshot.files
			clip = {
				kind: 'file',
				hash: `f:${sha1(files.join('\n'))}`,
				preview: files.map((f) => basename(f)).join('\n'),
				size: files.length,
				files,
				source
			}
		} else if (snapshot.text !== undefined) {
			const text = snapshot.text
			if (text.length > MAX_TEXT_LENGTH) return
			const cls = classifyText(text, front?.name)
			const { preview, size, lines } = summarizeText(text)
			clip = {
				kind: cls.kind,
				hash: `t:${sha1(text)}`,
				preview,
				size,
				lines,
				rich: !!(snapshot.html || snapshot.rtf),
				payload: { text, html: snapshot.html, rtf: snapshot.rtf },
				url: cls.url,
				color: cls.color,
				source
			}
		} else if (snapshot.image && snapshot.imageHash) {
			const hash = `i:${snapshot.imageHash}`
			const image =
				this.deps.store.findByHash(hash)?.image ??
				this.saveImage(snapshot.image, snapshot.imageHash)
			clip = {
				kind: 'image',
				hash,
				preview: `Image ${image.width}×${image.height}`,
				size: image.bytes,
				image,
				source
			}
		}

		if (!clip) return
		const { isNew } = this.deps.store.add(clip)
		if (isNew) this.deps.store.prune(settings)
	}

	private saveImage(image: NativeImage, hash: string): ClipImage {
		const { imageDir } = this.deps.store
		const file = `${hash}.png`
		const thumb = `${hash}.thumb.png`
		const { width, height } = image.getSize()
		const png = image.toPNG()
		if (!existsSync(join(imageDir, file))) writeFileSync(join(imageDir, file), png)

		const scale = Math.min(1, THUMB_MAX.width / width, THUMB_MAX.height / height)
		const thumbImage =
			scale < 1
				? image.resize({
						width: Math.max(1, Math.round(width * scale)),
						height: Math.max(1, Math.round(height * scale)),
						quality: 'good'
					})
				: image
		writeFileSync(join(imageDir, thumb), thumbImage.toPNG())

		return { file, thumb, width, height, bytes: png.length }
	}
}
