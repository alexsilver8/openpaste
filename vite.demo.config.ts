import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Browser-only build of the shelf UI backed by an in-memory mock API.
 * Handy for iterating on the UI without Electron, and for a hosted live demo.
 */
export default defineConfig({
	root: resolve(__dirname, 'src/renderer'),
	base: './',
	resolve: {
		alias: {
			'@shared': resolve(__dirname, 'src/shared'),
			'@renderer': resolve(__dirname, 'src/renderer/src')
		}
	},
	plugins: [react()],
	build: {
		outDir: resolve(__dirname, 'demo-dist'),
		emptyOutDir: true
	}
})
