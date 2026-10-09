import { memo, useEffect, useState } from 'react'
import { formatAccelerator, keyEventToAccelerator } from '@shared/accelerator'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { api } from '@renderer/api'
import { platform } from '@renderer/env'
import type { ShortcutRecorderProps } from './shortcut-recorder.types'

/** Click, press a key combination, done. Esc cancels; Backspace restores the default. */
const ShortcutRecorder = (props: ShortcutRecorderProps) => {
	const { value, onChange } = props

	const [recording, setRecording] = useState(false)
	const [error, setError] = useState<string | undefined>()

	useEffect(() => {
		if (!recording) return
		api.setShortcutSuspended(true)
		const onKey = async (e: KeyboardEvent): Promise<void> => {
			e.preventDefault()
			e.stopPropagation()
			if (e.key === 'Escape') return setRecording(false)
			let accelerator: string | null
			if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
				accelerator = DEFAULT_SETTINGS.shortcut
			} else {
				accelerator = keyEventToAccelerator(e, platform)
				if (!accelerator) return
			}
			setRecording(false)
			// Re-enable first so the main process validates the new shortcut for real.
			api.setShortcutSuspended(false)
			setError(await onChange(accelerator))
		}
		window.addEventListener('keydown', onKey, true)

		return () => {
			window.removeEventListener('keydown', onKey, true)
			api.setShortcutSuspended(false)
		}
	}, [recording, onChange])

	const handleClick = () => {
		setError(undefined)
		setRecording((r) => !r)
	}

	return (
		<div className="shortcut">
			<button
				type="button"
				className={`shortcut-button${recording ? ' is-recording' : ''}`}
				onClick={handleClick}
				onBlur={() => setRecording(false)}
				aria-live="polite"
			>
				{recording ? 'Press a shortcut…' : <kbd>{formatAccelerator(value, platform)}</kbd>}
			</button>
			{recording && (
				<span className="field-note">Esc to cancel, Backspace for the default</span>
			)}
			{error && (
				<span className="field-note is-error" role="alert">
					{error}
				</span>
			)}
		</div>
	)
}

export default memo(ShortcutRecorder)
