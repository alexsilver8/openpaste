import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isDemo, nativeMaterial, platform } from './env'
import { ShelfApp } from './shelf/ShelfApp'
import { SettingsApp } from './settings/SettingsApp'
import './styles/base.css'
import './styles/shelf.css'
import './styles/settings.css'

const root = document.documentElement
root.dataset.platform = platform
root.dataset.material = String(nativeMaterial)

async function boot(): Promise<void> {
  const container = document.getElementById('root')!
  if (isDemo) {
    root.dataset.view = 'demo'
    const [{ DemoFrame }] = await Promise.all([import('./demo/DemoFrame'), import('./styles/demo.css')])
    createRoot(container).render(
      <StrictMode>
        <DemoFrame />
      </StrictMode>
    )
    return
  }
  const view = location.hash === '#settings' ? 'settings' : 'shelf'
  root.dataset.view = view
  createRoot(container).render(<StrictMode>{view === 'settings' ? <SettingsApp /> : <ShelfApp />}</StrictMode>)
}

void boot()
