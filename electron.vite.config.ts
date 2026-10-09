import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const alias = {
	'@shared': resolve(__dirname, 'src/shared'),
	'@renderer': resolve(__dirname, 'src/renderer/src'),
	'@resources': resolve(__dirname, 'resources')
}

/**
 * Inject a strict Content-Security-Policy into the production renderer.
 * It is skipped in dev because Vite's HMR client relies on inline scripts.
 */
function productionCsp(): Plugin {
	return {
		name: 'openpaste:csp',
		apply: 'build',
		transformIndexHtml(html) {
			const csp = [
				"default-src 'self'",
				"script-src 'self'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' openpaste: data: blob:",
				"font-src 'self' data:",
				"connect-src 'self'",
				"object-src 'none'",
				"base-uri 'none'"
			].join('; ')

			return html.replace(
				'<head>',
				`<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
			)
		}
	}
}

export default defineConfig({
	main: {
		resolve: { alias }
	},
	preload: {
		resolve: { alias }
	},
	renderer: {
		root: resolve(__dirname, 'src/renderer'),
		resolve: { alias },
		plugins: [react(), productionCsp()],
		build: { minify: true }
	}
})
