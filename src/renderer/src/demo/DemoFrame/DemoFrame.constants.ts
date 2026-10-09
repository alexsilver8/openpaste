import { formatAccelerator } from '@shared/accelerator'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { platform } from '../../env'

export const SHORTCUT = formatAccelerator(DEFAULT_SETTINGS.shortcut, platform)
