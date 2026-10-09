# Contributing to OpenPaste

Thanks for helping. Bug reports, fixes and features are all welcome.

## Getting set up

You need Node.js 22.12 or newer and pnpm 12 (`npm install -g pnpm`).

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts Electron with hot reload for the UI. The shelf opens on launch in development;
after that use the shortcut or the tray icon. Set `OPENPASTE_KEEP_OPEN=1` to stop the shelf from
hiding when it loses focus, which makes inspecting it with DevTools much easier.

To work on the UI alone, `pnpm demo` serves the shelf in a browser with sample data and a mock
of the main process. Copy text on that page and it shows up on the shelf.

Set `OPENPASTE_DATA_DIR=/some/folder` to keep a development history separate from your real one.

## Before opening a pull request

```bash
pnpm typecheck
pnpm test
pnpm format
```

- Keep pull requests focused: one fix or feature each.
- Add or update tests in `tests/` when you change classification, search, settings or the store.
- Platform-specific code lives in `src/main/platform/`. If you can only test on one OS, say which
  in the pull request so someone else can check the others.
- Code follows the code style and component layout below.
- UI copy is sentence case and says what things do ("Paste as plain text", not "Submit").

## Code style

- Indent with tabs, shown 4 wide. YAML can't use tabs, so it uses 4 spaces. `pnpm format`
  (Prettier) takes care of this.
- Leave a blank line above every `return` that isn't the first statement in its block, including
  inside `if` blocks, `case`s and callbacks. A comment directly above the `return` stays with it,
  and the blank line goes above the comment.
- Imports from outside the current folder use an alias, never `../`: `@renderer/…` for
  `src/renderer/src`, `@shared/…` for `src/shared` and `@resources/…` for `resources`. Use `./`
  only for files in the same folder or below it.

## Component layout

Every React component in `src/renderer/src` has its own folder, named after it in kebab-case:

```
card/
├── card.tsx            the component (Card), and nothing else
├── card.props.ts       its props type (CardProps)
├── card.constants.ts   constants it uses
├── card.utils.ts       helper functions it uses
├── index.ts            exports the component, plus anything other folders need
└── components/         components only Card uses, each laid out the same way
    ├── app-mark/
    └── body/
```

A component is an arrow function, default-exported wrapped in `memo`, even when it doesn't need
memoizing:

```tsx
const Card = ({ item, selected }: CardProps) => {
	// …
}

export default memo(Card)
```

- Folder and file names are kebab-case (`top-bar/top-bar.tsx`); the component itself keeps its
  PascalCase name (`TopBar`).
- One component per file, and its file exports only that component.
- The folder's `index.ts` re-exports it by name (`export { default as Card } from './card'`), so
  other files import `{ Card }`.
- `memo` skips re-renders when props haven't changed, so read outside values (the time, `window`,
  …) in effects and event handlers, or pass them in as props, rather than while rendering.
- Props go in `<name>.props.ts` as `<Name>Props`, along with any types that only describe a prop
  (like `MenuEntry` for `Menu`'s entries). A component with no props has no props file.
- Top-level constants go in `<name>.constants.ts` (`.tsx` if they contain JSX), and helper
  functions in `<name>.utils.ts`. Leave out the files a component doesn't need.
- A component used only by one parent lives in that parent's `components/` folder. Components
  used in several places live in `src/renderer/src/components/`.
- Import a component's folder (`'./components/card'`), not the files inside it.

## Commits and pull requests

`main` is protected: every change goes through a pull request, and two checks must pass before
it can merge:

- `check`: typecheck, tests and build
- `title`: the pull request title follows the format below

Pull requests are squash-merged, and the title becomes the commit message on `main`, so the title
matters more than the commits on your branch. The title also sets the pull request's label
(`fix` → `bug`, `feat` → `enhancement`, `docs` → `documentation`, and the type's own name for the
rest, plus `breaking change` for `!`), and whoever opens a pull request is assigned to it. Pull request titles and commit messages use
[gitmoji](https://gitmoji.dev) with [Conventional Commits](https://www.conventionalcommits.org).
Only emojis from the official gitmoji list are accepted, typed as the emoji itself (`✨`, not
`:sparkles:`):

```
<gitmoji> <type>(<scope>): <summary>
```

| Example                                               | When                       |
| ----------------------------------------------------- | -------------------------- |
| `✨ feat(search): filter by source app`               | A new feature              |
| `🐛 fix(shelf): keep focus in the app you were using` | A bug fix                  |
| `💄 style(settings): make the top strip draggable`    | UI or styling only         |
| `♻️ refactor(store): split payloads from the index`   | Code change, same behavior |
| `✅ test(classify): cover shell commands`             | Tests                      |
| `📝 docs: explain Wayland shortcuts`                  | Documentation              |
| `🔧 chore: switch from npm to pnpm`                   | Tooling and config         |

The scope is optional; use the area of the app you touched (`shelf`, `settings`, `store`, `capture`,
`search`, `ci`). Add `!` after the type or scope for a breaking change (`💥 feat(api)!: …`). The full
rules live in `scripts/check-pr-title.mjs`; to try a title locally:

```bash
PR_TITLE="✨ feat(search): filter by source app" node scripts/check-pr-title.mjs
```

## Testing pasting on each platform

| OS      | What to check                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------- |
| macOS   | First paste prompts for Accessibility; after allowing, Return pastes into TextEdit, Slack and a browser. |
| Windows | Return pastes into Notepad and a browser; focus returns to the app you came from.                        |
| Linux   | With `xdotool` (X11) or `wtype` (Wayland) installed, Return pastes; in a terminal it sends Ctrl+Shift+V. |

Also check that copying from a password manager is _not_ recorded, and that images and files
copied from the file manager show up with the right card.

## Releasing

Once the pull requests you want to ship are merged, run this from `main`:

```bash
pnpm release
```

It looks at the pull requests merged since the last release and picks the next version from their
titles: a `!` makes it a major release, any `feat` a minor one, anything else a patch. It shows
you the changelog it wrote and asks before going further. Then it bumps `package.json`, adds the
section to `CHANGELOG.md`, and opens a release pull request with auto-merge turned on.

When that pull request's checks pass, it merges by itself. The Release workflow then builds the
installers on macOS, Windows and Linux and publishes the GitHub release with the changelog as its
notes. It only publishes if all three builds succeed.

Options:

```bash
pnpm release --dry-run   # show the version and changelog without changing anything
pnpm release minor       # choose the bump yourself: patch, minor or major
pnpm release 2.0.0       # or an exact version
```

If a build fails, fix it in a normal pull request. Merging the fix runs the Release workflow
again, and it picks up where it left off because that version still hasn't been released. You can
also re-run it from the Actions tab.

To sign builds, add `CSC_LINK` and `CSC_KEY_PASSWORD` (and for macOS notarization `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) as repository secrets.
