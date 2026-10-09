export interface EmptyStateProps {
	reason: 'history' | 'search' | 'board' | 'kind'
	query: string
	shortcut: string
	boardName?: string
}
