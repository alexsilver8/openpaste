import { describe, expect, it } from 'vitest'
import { parseLsappinfo, parseXprop } from '../src/main/platform/frontmost'

describe('parseLsappinfo', () => {
  it('reads the frontmost app from lsappinfo output', () => {
    const out = `"Visual Studio Code" ASN:0x0-0x2b02b:
    bundleID="com.microsoft.VSCode"
    bundle path="/Applications/Visual Studio Code.app"
    executable path="/Applications/Visual Studio Code.app/Contents/MacOS/Electron"
    pid = 812 type="Foreground" flavor=3 Version="1.95.0" fileType="APPL" creator="????" Arch=ARM64`
    expect(parseLsappinfo(out)).toEqual({
      name: 'Visual Studio Code',
      id: 'com.microsoft.VSCode',
      path: '/Applications/Visual Studio Code.app',
      pid: 812
    })
  })
  it('returns null for unexpected output', () => {
    expect(parseLsappinfo('')).toBeNull()
  })
})

describe('parseXprop', () => {
  it('reads WM_CLASS and pid', () => {
    expect(parseXprop('WM_CLASS(STRING) = "code", "Code"\n_NET_WM_PID(CARDINAL) = 4242')).toEqual({
      className: 'Code',
      pid: 4242
    })
  })
})
