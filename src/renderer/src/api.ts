import type { OpenPasteAPI } from '@shared/types'
import { createMockApi } from './demo/mockApi'

/** The real bridge inside Electron; an in-memory mock in the browser demo. */
export const api: OpenPasteAPI = window.openpaste ?? createMockApi()
