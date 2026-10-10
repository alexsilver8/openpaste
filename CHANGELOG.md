# Changelog

All notable changes to OpenPaste. Versions follow [Semantic Versioning](https://semver.org).

## [1.0.1](https://github.com/alexsilver8/openpaste/compare/v1.0.0...v1.0.1) (2026-10-10)


### Bug Fixes

* **shelf:** show the site name for links that contain % ([#22](https://github.com/alexsilver8/openpaste/issues/22)) ([4f87816](https://github.com/alexsilver8/openpaste/commit/4f87816c3ab6c5c176e7cb58dc64a1643780b893))


### Documentation

* list every shelf shortcut in the README ([#21](https://github.com/alexsilver8/openpaste/issues/21)) ([48d6680](https://github.com/alexsilver8/openpaste/commit/48d6680eefee9e5da16a4e2b38accd8b3c019fee))

## 1.0.0

The first release.

### Clipboard history

- Records text, rich text, links, code, colors, images and files, with the app each came from.
- De-duplicates repeat copies: copying something again moves it to the front.
- Skips anything password managers mark as private, apps on your ignore list, and everything
  while capturing is paused.
- Keeps unpinned items for 30 days or 2,000 items by default; both limits are in Settings.

### The shelf

- Slides up over any app, including full-screen ones on macOS, with ⇧⌘V or Ctrl+Shift+V.
- Cards show content the way it looks: color swatches, image previews, link hosts and lightly
  highlighted code.
- Type to search, or filter with `is:image`, `is:link`, `is:code`, `is:color`, `is:file` and
  `app:<name>`.
- Return pastes into the app you were using; Shift+Return pastes without formatting;
  ⌘1–⌘9 / Ctrl+1–Ctrl+9 paste one of the first nine cards.
- Preview, edit, rename, copy and delete (with undo) from the keyboard or the right-click menu.
- Drag cards into other apps, or onto a pinboard tab to pin them.

### Pinboards

- Save snippets, replies and colors to named, colored pinboards. Pinned items are never cleaned
  up automatically.

### Settings

- Change the shortcut, open at login, light or dark appearance, paste behavior, history limits,
  and which apps to ignore.

### Platforms

- macOS 13+ (Apple Silicon and Intel), Windows 10+ (x64 and Arm), and 64-bit Linux
  (AppImage and .deb).
- Direct pasting uses Accessibility on macOS, a built-in helper on Windows, and xdotool (X11) or
  wtype/ydotool (Wayland) on Linux.
