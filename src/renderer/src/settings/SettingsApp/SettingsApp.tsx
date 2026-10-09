import { useCallback, useEffect, useState } from 'react'
import {
	DEFAULT_IGNORED_APPS,
	DEFAULT_SETTINGS,
	HISTORY_DAY_OPTIONS,
	HISTORY_LIMIT_OPTIONS
} from '@shared/settings'
import type { AppEnv, Permissions, Settings } from '@shared/types'
import { api } from '../../api'
import { Icon } from '../../components/Icon'
import { isMac } from '../../env'
import logoUrl from '../../../../../resources/icon.png'
import { Row } from './components/Row'
import { ShortcutRecorder } from './components/ShortcutRecorder'
import { Toggle } from './components/Toggle'
import { Section } from './components/Section'
import { THEMES } from './SettingsApp.constants'

export function SettingsApp({ embedded = false }: { embedded?: boolean }) {
	const [settings, setSettings] = useState<Settings | null>(null)
	const [env, setEnv] = useState<AppEnv | null>(null)
	const [permissions, setPermissions] = useState<Permissions>({ accessibility: null })
	const [newApp, setNewApp] = useState('')
	const [confirmClear, setConfirmClear] = useState(false)
	const [keepPinned, setKeepPinned] = useState(true)
	const [cleared, setCleared] = useState(false)

	useEffect(() => {
		const load = (): void => void api.getSettings().then(setSettings)
		load()
		void api.getEnv().then(setEnv)
		const refreshPermissions = (): void => void api.getPermissions().then(setPermissions)
		refreshPermissions()
		window.addEventListener('focus', refreshPermissions)
		const off = api.on('settings-changed', load)
		return () => {
			off()
			window.removeEventListener('focus', refreshPermissions)
		}
	}, [])

	useEffect(() => {
		if (settings && !embedded) document.documentElement.dataset.theme = settings.theme
	}, [settings, embedded])

	const update = useCallback(async (patch: Partial<Settings>): Promise<string | undefined> => {
		const result = await api.setSettings(patch)
		setSettings(result.settings)
		return result.ok ? undefined : result.error
	}, [])

	const setShortcut = useCallback((shortcut: string) => update({ shortcut }), [update])

	if (!settings) return <div className="settings" />

	const addIgnoredApp = (): void => {
		const name = newApp.trim()
		if (!name) return
		void update({ ignoredApps: [...settings.ignoredApps, name] })
		setNewApp('')
	}

	return (
		<div className={`settings${embedded ? ' is-embedded' : ''}`}>
			{!embedded && <div className="titlebar" aria-hidden="true" />}
			<header className="settings-header">
				<img className="settings-logo" src={logoUrl} alt="" />
				<div>
					<h1>OpenPaste</h1>
					<p>Everything you copy, one shortcut away. Stored only on this computer.</p>
				</div>
			</header>

			<Section title="General">
				<Row label="Open OpenPaste with" note="Works from any app.">
					<ShortcutRecorder value={settings.shortcut} onChange={setShortcut} />
				</Row>
				<Row label="Open at login" htmlFor="s-login">
					<Toggle
						id="s-login"
						checked={settings.launchAtLogin}
						onChange={(v) => void update({ launchAtLogin: v })}
					/>
				</Row>
				<Row label="Appearance">
					<div className="segmented" role="radiogroup" aria-label="Appearance">
						{THEMES.map((t) => (
							<button
								key={t.value}
								type="button"
								role="radio"
								aria-checked={settings.theme === t.value}
								onClick={() => void update({ theme: t.value })}
							>
								{t.label}
							</button>
						))}
					</div>
				</Row>
			</Section>

			<Section title="Pasting">
				<Row
					label="Paste into the app you were using"
					note="When off, choosing an item copies it and you paste it yourself."
					htmlFor="s-direct"
				>
					<Toggle
						id="s-direct"
						checked={settings.pasteDirectly}
						onChange={(v) => void update({ pasteDirectly: v })}
					/>
				</Row>
				{isMac && settings.pasteDirectly && permissions.accessibility === false && (
					<div className="callout" role="note">
						<Icon name="paste" size={18} />
						<p>
							macOS needs your permission before OpenPaste can press ⌘V for you. Turn
							on OpenPaste under Privacy &amp; Security → Accessibility.
						</p>
						<button
							type="button"
							className="button"
							onClick={() => api.openAccessibilitySettings()}
						>
							Open Accessibility settings
						</button>
					</div>
				)}
				<Row
					label="Always paste as plain text"
					note="Strips fonts, colors and links. Hold Shift while pasting to do the opposite."
					htmlFor="s-plain"
				>
					<Toggle
						id="s-plain"
						checked={settings.plainTextByDefault}
						onChange={(v) => void update({ plainTextByDefault: v })}
					/>
				</Row>
			</Section>

			<Section title="History">
				<Row
					label="Keep items for"
					note="Items saved to a pinboard are kept until you delete them."
					htmlFor="s-days"
				>
					<select
						id="s-days"
						className="select"
						value={settings.historyDays}
						onChange={(e) => void update({ historyDays: Number(e.target.value) })}
					>
						{HISTORY_DAY_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</Row>
				<Row label="Keep at most" htmlFor="s-limit">
					<select
						id="s-limit"
						className="select"
						value={settings.historyLimit}
						onChange={(e) => void update({ historyLimit: Number(e.target.value) })}
					>
						{HISTORY_LIMIT_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</Row>
				<Row label="Save images" htmlFor="s-images">
					<Toggle
						id="s-images"
						checked={settings.captureImages}
						onChange={(v) => void update({ captureImages: v })}
					/>
				</Row>
				<Row
					label="Save copied files"
					note="Stores the file locations, not copies of the files."
					htmlFor="s-files"
				>
					<Toggle
						id="s-files"
						checked={settings.captureFiles}
						onChange={(v) => void update({ captureFiles: v })}
					/>
				</Row>
				<Row
					label="Clear history"
					note={
						cleared ? 'History cleared.' : 'Deletes recorded items from this computer.'
					}
				>
					{confirmClear ? (
						<div className="confirm">
							<label className="check">
								<input
									type="checkbox"
									checked={keepPinned}
									onChange={(e) => setKeepPinned(e.target.checked)}
								/>
								Keep pinboards
							</label>
							<button
								type="button"
								className="button"
								onClick={() => setConfirmClear(false)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="button button--danger-solid"
								onClick={async () => {
									await api.clearHistory({ keepPinned })
									setConfirmClear(false)
									setCleared(true)
								}}
							>
								Clear history
							</button>
						</div>
					) : (
						<button
							type="button"
							className="button"
							onClick={() => {
								setCleared(false)
								setConfirmClear(true)
							}}
						>
							Clear history…
						</button>
					)}
				</Row>
			</Section>

			<Section title="Privacy">
				<Row
					label="Pause capturing"
					note="Nothing new is recorded until you turn this off."
					htmlFor="s-paused"
				>
					<Toggle
						id="s-paused"
						checked={settings.paused}
						onChange={(v) => void update({ paused: v })}
					/>
				</Row>
				<Row
					label="Skip passwords"
					note="Ignores anything password managers mark as private when they copy it."
					htmlFor="s-concealed"
				>
					<Toggle
						id="s-concealed"
						checked={settings.ignoreConcealed}
						onChange={(v) => void update({ ignoreConcealed: v })}
					/>
				</Row>
				<div className="row-setting row-setting--stack">
					<div className="row-setting-text">
						<span className="row-setting-label">Never record copies from</span>
						<p className="row-setting-note">
							Match by app name. Copies made in these apps never reach your history.
						</p>
					</div>
					<ul className="chips" aria-label="Ignored apps">
						{settings.ignoredApps.map((app) => (
							<li key={app} className="chip is-on">
								{app}
								<button
									type="button"
									aria-label={`Stop ignoring ${app}`}
									onClick={() =>
										void update({
											ignoredApps: settings.ignoredApps.filter(
												(a) => a !== app
											)
										})
									}
								>
									<Icon name="close" size={11} />
								</button>
							</li>
						))}
					</ul>
					<form
						className="add-app"
						onSubmit={(e) => {
							e.preventDefault()
							addIgnoredApp()
						}}
					>
						<input
							className="text-input"
							placeholder="App name, e.g. Keychain Access"
							value={newApp}
							onChange={(e) => setNewApp(e.target.value)}
						/>
						<button type="submit" className="button" disabled={!newApp.trim()}>
							Add app
						</button>
						{settings.ignoredApps.join() !== DEFAULT_IGNORED_APPS.join() && (
							<button
								type="button"
								className="button button--quiet"
								onClick={() =>
									void update({ ignoredApps: DEFAULT_SETTINGS.ignoredApps })
								}
							>
								Restore defaults
							</button>
						)}
					</form>
				</div>
			</Section>

			<Section title="About">
				<Row
					label={`OpenPaste ${env?.version ?? ''}`}
					note="Free and open source under the MIT license. Your history never leaves this computer."
				>
					{env?.platform !== 'web' && (
						<button
							type="button"
							className="button"
							onClick={() => api.revealDataFolder()}
						>
							<Icon name="folder" size={15} /> Show data folder
						</button>
					)}
				</Row>
			</Section>
		</div>
	)
}
