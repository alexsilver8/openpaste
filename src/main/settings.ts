import { EventEmitter } from 'node:events'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, sanitizeSettings } from '@shared/settings'
import type { Settings } from '@shared/types'

/** Settings persisted as JSON. Emits `changed` with (next, previous). */
export class SettingsStore extends EventEmitter {
  private value: Settings

  constructor(private readonly file: string) {
    super()
    let raw: unknown = {}
    if (existsSync(file)) {
      try {
        raw = JSON.parse(readFileSync(file, 'utf8'))
      } catch {
        raw = {}
      }
    }
    this.value = sanitizeSettings(raw, DEFAULT_SETTINGS)
  }

  get(): Settings {
    return { ...this.value, ignoredApps: [...this.value.ignoredApps] }
  }

  set(patch: Partial<Settings>): Settings {
    const previous = this.value
    this.value = sanitizeSettings({ ...previous, ...patch }, previous)
    this.save()
    this.emit('changed', this.get(), previous)
    return this.get()
  }

  private save(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.value, null, 2))
    renameSync(tmp, this.file)
  }
}
