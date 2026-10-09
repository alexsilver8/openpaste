import { useEffect } from 'react'

export interface ToastState {
	id: number
	message: string
	action?: { label: string; run(): void }
}

export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss(): void }) {
	useEffect(() => {
		const timer = setTimeout(onDismiss, 5000)
		return () => clearTimeout(timer)
	}, [toast.id, onDismiss])
	return (
		<div className="toast" role="status">
			<span>{toast.message}</span>
			{toast.action && (
				<button
					type="button"
					className="toast-action"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => {
						toast.action?.run()
						onDismiss()
					}}
				>
					{toast.action.label}
				</button>
			)}
		</div>
	)
}
