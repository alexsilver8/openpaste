import { useEffect } from 'react'
import type { ToastProps } from './toast.props'

export function Toast({ toast, onDismiss }: ToastProps) {
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
