import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'

export const SCHEME = 'openpaste'

/** Must run before the app is ready. */
export function registerSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

/**
 * Serves stored images and app icons to the shelf as `openpaste://images/<file>`
 * and `openpaste://icons/<file>`. Only plain file names inside those two folders
 * are reachable; anything else is a 404.
 */
export function handleScheme(dirs: { images: string; icons: string }): void {
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url)
    const root = url.hostname === 'images' ? dirs.images : url.hostname === 'icons' ? dirs.icons : null
    const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!root || !name || name !== basename(name) || name.startsWith('.')) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(join(root, name)).toString())
  })
}
