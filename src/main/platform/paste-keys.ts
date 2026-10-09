import { systemPreferences } from 'electron'
import type { PasteOutcome } from '@shared/types'
import { run, type AppInfo } from './frontmost'
import type { WinHelper } from './win-helper'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Posts ⌘V through CoreGraphics. Needs only Accessibility, not Automation. */
const JXA_CMD_V = `ObjC.import('CoreGraphics');
var src = $.CGEventSourceCreate($.kCGEventSourceStateCombinedSessionState);
var down = $.CGEventCreateKeyboardEvent(src, 9, true);
var up = $.CGEventCreateKeyboardEvent(src, 9, false);
$.CGEventSetFlags(down, $.kCGEventFlagMaskCommand);
$.CGEventSetFlags(up, $.kCGEventFlagMaskCommand);
$.CGEventPost($.kCGHIDEventTap, down);
$.CGEventPost($.kCGHIDEventTap, up);
'ok'`

const TERMINALS =
  /terminal|konsole|kitty|alacritty|wezterm|tilix|xterm|urxvt|terminator|foot|ghostty|guake|yakuake/i

export function hasAccessibility(): boolean | null {
  if (process.platform !== 'darwin') return null
  return systemPreferences.isTrustedAccessibilityClient(false)
}

/**
 * Sends the platform's paste keystroke to whatever app is in front.
 * Call after the shelf is hidden so focus has returned to `target`.
 */
export async function sendPasteKeystroke(
  target: AppInfo | null,
  helper: WinHelper | null
): Promise<PasteOutcome> {
  switch (process.platform) {
    case 'darwin': {
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        // Shows the system prompt (once) that leads to Privacy & Security → Accessibility.
        systemPreferences.isTrustedAccessibilityClient(true)
        return 'no-permission'
      }
      await delay(70)
      try {
        await run('osascript', ['-l', 'JavaScript', '-e', JXA_CMD_V])
        return 'pasted'
      } catch {
        try {
          await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
          return 'pasted'
        } catch {
          return 'failed'
        }
      }
    }

    case 'win32': {
      if (!helper) return 'unsupported'
      if (target?.window) await helper.activate(target.window)
      await delay(40)
      return (await helper.paste()) ? 'pasted' : 'failed'
    }

    default: {
      const terminal = TERMINALS.test(`${target?.name ?? ''} ${target?.id ?? ''}`)
      const wayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY
      const attempts: [string, string[]][] = []
      if (!wayland || process.env.DISPLAY) {
        const keys = terminal ? 'ctrl+shift+v' : 'ctrl+v'
        attempts.push([
          'xdotool',
          target?.window
            ? ['windowactivate', '--sync', target.window, 'key', '--clearmodifiers', keys]
            : ['key', '--clearmodifiers', keys]
        ])
      }
      if (wayland) {
        attempts.push([
          'wtype',
          terminal ? ['-M', 'ctrl', '-M', 'shift', '-k', 'v', '-m', 'shift', '-m', 'ctrl'] : ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']
        ])
        attempts.push(['ydotool', terminal ? ['key', '29:1', '42:1', '47:1', '47:0', '42:0', '29:0'] : ['key', '29:1', '47:1', '47:0', '29:0']])
      }
      await delay(60)
      for (const [cmd, args] of attempts) {
        try {
          await run(cmd, args)
          return 'pasted'
        } catch {
          /* try the next tool */
        }
      }
      return 'unsupported'
    }
  }
}
