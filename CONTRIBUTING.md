# Contributing to OpenPaste

Thanks for helping. Bug reports, fixes and features are all welcome.

## Getting set up

```bash
npm install
npm run dev
```

`npm run dev` starts Electron with hot reload for the UI. The shelf opens on launch in development;
after that use the shortcut or the tray icon. Set `OPENPASTE_KEEP_OPEN=1` to stop the shelf from
hiding when it loses focus, which makes inspecting it with DevTools much easier.

To work on the UI alone, `npm run demo` serves the shelf in a browser with sample data and a mock
of the main process. Copy text on that page and it shows up on the shelf.

Set `OPENPASTE_DATA_DIR=/some/folder` to keep a development history separate from your real one.

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run format
```

- Keep pull requests focused: one fix or feature each.
- Add or update tests in `tests/` when you change classification, search, settings or the store.
- Platform-specific code lives in `src/main/platform/`. If you can only test on one OS, say which
  in the pull request so someone else can check the others.
- UI copy is sentence case and says what things do ("Paste as plain text", not "Submit").

## Testing pasting on each platform

| OS      | What to check                                                                 |
| ------- | ----------------------------------------------------------------------------- |
| macOS   | First paste prompts for Accessibility; after allowing, Return pastes into TextEdit, Slack and a browser. |
| Windows | Return pastes into Notepad and a browser; focus returns to the app you came from. |
| Linux   | With `xdotool` (X11) or `wtype` (Wayland) installed, Return pastes; in a terminal it sends Ctrl+Shift+V. |

Also check that copying from a password manager is *not* recorded, and that images and files
copied from the file manager show up with the right card.

## Releasing

Bump `version` in `package.json`, commit, then tag and push:

```bash
git tag v0.2.0
git push --tags
```

The Release workflow builds installers for macOS, Windows and Linux and attaches them to a draft
GitHub release. To sign builds, add `CSC_LINK` and `CSC_KEY_PASSWORD` (and for macOS
notarization `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) as repository secrets.
