import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, nativeImage, type NativeImage } from 'electron'
import { dominantColor, hashColor } from '@shared/color'
import type { SourceApp } from '@shared/types'
import type { AppInfo } from './platform/frontmost'

/**
 * Caches the icon of each app we see copies from, plus a tint color for the
 * card header derived from that icon.
 */
export class AppIcons {
	private cache = new Map<string, Promise<Pick<SourceApp, 'icon' | 'color'>>>()

	constructor(private readonly dir: string) {}

	private static keyFor(info: AppInfo): string {
		return (info.id || info.name).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'app'
	}

	async toSource(info: AppInfo): Promise<SourceApp> {
		const key = AppIcons.keyFor(info)
		let pending = this.cache.get(key)
		if (!pending) {
			pending = this.load(info, key)
			this.cache.set(key, pending)
		}
		return { name: info.name, id: info.id, ...(await pending) }
	}

	private async load(info: AppInfo, key: string): Promise<Pick<SourceApp, 'icon' | 'color'>> {
		const file = `${key}.png`
		const fullPath = join(this.dir, file)
		try {
			let image: NativeImage | null = null
			if (existsSync(fullPath)) {
				image = nativeImage.createFromPath(fullPath)
			} else if (info.path && process.platform !== 'linux') {
				image = await app.getFileIcon(info.path, { size: 'normal' })
				if (!image.isEmpty()) writeFileSync(fullPath, image.toPNG())
			}
			if (image && !image.isEmpty()) {
				const small = image.resize({ width: 16, height: 16, quality: 'good' })
				const color = dominantColor(small.toBitmap(), 16, 16) ?? hashColor(info.name)
				return { icon: file, color }
			}
		} catch {
			/* fall back to a generated color */
		}
		return { color: hashColor(info.name) }
	}
}
