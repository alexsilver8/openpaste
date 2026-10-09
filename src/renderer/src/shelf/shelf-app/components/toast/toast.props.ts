export interface ToastState {
	id: number
	message: string
	action?: { label: string; run(): void }
}

export interface ToastProps {
	toast: ToastState
	onDismiss(): void
}
