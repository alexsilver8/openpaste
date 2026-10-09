export interface ShortcutRecorderProps {
	value: string
	onChange(accelerator: string): Promise<string | undefined>
}
