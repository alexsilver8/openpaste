export interface ColorSwatchProps {
	color: string
	selected: boolean
	onSelect(color: string): void
}
