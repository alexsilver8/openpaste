import { memo, useEffect, type MouseEvent } from 'react'
import type { ToastProps } from './toast.props'

const Toast = (props: ToastProps) => {
	const { toast, onDismiss } = props

	useEffect(() => {
		const timer = setTimeout(onDismiss, 5000)

		return () => clearTimeout(timer)
	}, [toast.id, onDismiss])

	const handleActionMouseDown = (e: MouseEvent<HTMLButtonElement>) => e.preventDefault()

	const handleActionClick = () => {
		toast.action?.run()
		onDismiss()
	}

	return (
		<div className="toast" role="status">
			<span>{toast.message}</span>
			{toast.action && (
				<button
					type="button"
					className="toast-action"
					onMouseDown={handleActionMouseDown}
					onClick={handleActionClick}
				>
					{toast.action.label}
				</button>
			)}
		</div>
	)
}

export default memo(Toast)
