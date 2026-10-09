import { memo, useCallback, useEffect, useState, type ChangeEvent, type SubmitEvent } from 'react'
import {
	DEFAULT_IGNORED_APPS,
	DEFAULT_SETTINGS,
	HISTORY_DAY_OPTIONS,
	HISTORY_LIMIT_OPTIONS
} from '@shared/settings'
import type { AppEnv, Permissions, Settings, ThemeSetting } from '@shared/types'
import { api } from '@renderer/api'
import { Icon } from '@renderer/components/icon'
import { isMac } from '@renderer/env'
import logoUrl from '@resources/icon.png'
import { IgnoredApp } from './components/ignored-app'
import { Row } from './components/row'
import { ShortcutRecorder } from './components/shortcut-recorder'
import { Toggle } from './components/toggle'
import { Section } from './components/section'
import { ThemeOption } from './components/theme-option'
import { THEMES } from './settings-app.constants'
import type { SettingsAppProps } from './settings-app.props'

const SettingsApp = (props: SettingsAppProps) => {
	const { embedded = false } = props

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

	const handleThemeSelect = (theme: ThemeSetting) => void update({ theme })

	const handleIgnoredAppRemove = (app: string) =>
		void update({ ignoredApps: settings.ignoredApps.filter((a) => a !== app) })

	const handleLaunchAtLoginChange = (v: boolean) => void update({ launchAtLogin: v })

	const handlePasteDirectlyChange = (v: boolean) => void update({ pasteDirectly: v })

	const handleAccessibilityClick = () => api.openAccessibilitySettings()

	const handlePlainTextByDefaultChange = (v: boolean) => void update({ plainTextByDefault: v })

	const handleHistoryDaysChange = (e: ChangeEvent<HTMLSelectElement, HTMLSelectElement>) =>
		void update({ historyDays: Number(e.target.value) })

	const handleHistoryLimitChange = (e: ChangeEvent<HTMLSelectElement, HTMLSelectElement>) =>
		void update({ historyLimit: Number(e.target.value) })

	const handleCaptureImagesChange = (v: boolean) => void update({ captureImages: v })

	const handleCaptureFilesChange = (v: boolean) => void update({ captureFiles: v })

	const handleKeepPinnedChange = (e: ChangeEvent<HTMLInputElement, HTMLInputElement>) =>
		setKeepPinned(e.target.checked)

	const handleClearCancelClick = () => setConfirmClear(false)

	const handleClearConfirmClick = async () => {
		await api.clearHistory({ keepPinned })
		setConfirmClear(false)
		setCleared(true)
	}

	const handleClearClick = () => {
		setCleared(false)
		setConfirmClear(true)
	}

	const handlePausedChange = (v: boolean) => void update({ paused: v })

	const handleIgnoreConcealedChange = (v: boolean) => void update({ ignoreConcealed: v })

	const handleAddAppSubmit = (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault()
		addIgnoredApp()
	}

	const handleNewAppChange = (e: ChangeEvent<HTMLInputElement, HTMLInputElement>) =>
		setNewApp(e.target.value)

	const handleResetIgnoredAppsClick = () =>
		void update({ ignoredApps: DEFAULT_SETTINGS.ignoredApps })

	const handleRevealDataFolderClick = () => api.revealDataFolder()

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
						onChange={handleLaunchAtLoginChange}
					/>
				</Row>
				<Row label="Appearance">
					<div className="segmented" role="radiogroup" aria-label="Appearance">
						{THEMES.map((t) => (
							<ThemeOption
								key={t.value}
								value={t.value}
								label={t.label}
								checked={settings.theme === t.value}
								onSelect={handleThemeSelect}
							/>
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
						onChange={handlePasteDirectlyChange}
					/>
				</Row>
				{isMac && settings.pasteDirectly && permissions.accessibility === false && (
					<div className="callout" role="note">
						<Icon name="paste" size={18} />
						<p>
							macOS needs your permission before OpenPaste can press ⌘V for you. Turn
							on OpenPaste under Privacy &amp; Security → Accessibility.
						</p>
						<button type="button" className="button" onClick={handleAccessibilityClick}>
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
						onChange={handlePlainTextByDefaultChange}
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
						onChange={handleHistoryDaysChange}
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
						onChange={handleHistoryLimitChange}
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
						onChange={handleCaptureImagesChange}
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
						onChange={handleCaptureFilesChange}
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
									onChange={handleKeepPinnedChange}
								/>
								Keep pinboards
							</label>
							<button
								type="button"
								className="button"
								onClick={handleClearCancelClick}
							>
								Cancel
							</button>
							<button
								type="button"
								className="button button--danger-solid"
								onClick={handleClearConfirmClick}
							>
								Clear history
							</button>
						</div>
					) : (
						<button type="button" className="button" onClick={handleClearClick}>
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
					<Toggle id="s-paused" checked={settings.paused} onChange={handlePausedChange} />
				</Row>
				<Row
					label="Skip passwords"
					note="Ignores anything password managers mark as private when they copy it."
					htmlFor="s-concealed"
				>
					<Toggle
						id="s-concealed"
						checked={settings.ignoreConcealed}
						onChange={handleIgnoreConcealedChange}
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
							<IgnoredApp key={app} app={app} onRemove={handleIgnoredAppRemove} />
						))}
					</ul>
					<form className="add-app" onSubmit={handleAddAppSubmit}>
						<input
							className="text-input"
							placeholder="App name, e.g. Keychain Access"
							value={newApp}
							onChange={handleNewAppChange}
						/>
						<button type="submit" className="button" disabled={!newApp.trim()}>
							Add app
						</button>
						{settings.ignoredApps.join() !== DEFAULT_IGNORED_APPS.join() && (
							<button
								type="button"
								className="button button--quiet"
								onClick={handleResetIgnoredAppsClick}
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
							onClick={handleRevealDataFolderClick}
						>
							<Icon name="folder" size={15} /> Show data folder
						</button>
					)}
				</Row>
			</Section>
		</div>
	)
}

export default memo(SettingsApp)
