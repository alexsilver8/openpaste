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
pnpm cleaner
```

`pnpm cleaner` checks the conventions below that Prettier and TypeScript don't, and tells you
how to fix anything it finds. Right now it checks that component files declare no interfaces or
types. CI runs the same check on every pull request and marks each problem on its line. The rules
live in [alexsilver8/cleaner](https://github.com/alexsilver8/cleaner), shared with other
projects, so new rules are added there rather than in this repository.

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
- Don't use the `void` operator. Call a function whose result you don't need as a plain
  statement (`load()`), and give an arrow function that shouldn't return anything a block body
  (`() => { load() }`).

## Component layout

Every React component in `src/renderer/src` has its own folder, named after it in kebab-case:

```
card/
├── card.tsx            the component (Card), and nothing else
├── card.types.ts       its types: props (CardProps) and any others
├── card.constants.ts   constants it uses
├── card.utils.ts       helper functions it uses
├── index.ts            exports the component, plus anything other folders need
└── components/         components only Card uses, each laid out the same way
    ├── app-mark/
    └── body/
```

A component is an arrow function that takes `props` and destructures it on its first line, and
it's default-exported wrapped in `memo`, even when it doesn't need memoizing:

```tsx
const Card = (props: CardProps) => {
	const { item, selected } = props

	// …
}

export default memo(Card)
```

- Folder and file names are kebab-case (`top-bar/top-bar.tsx`); the component itself keeps its
  PascalCase name (`TopBar`).
- One component per file, and its file exports only that component.
- Props are read through that one `const { … } = props` line, followed by a blank line: no
  destructuring in the parameter list and no `props.x`. Defaults go in the destructure
  (`const { size = 16 } = props`).
- The folder's `index.ts` re-exports it by name (`export { default as Card } from './card'`), so
  other files import `{ Card }`.
- `memo` skips re-renders when props haven't changed, so read outside values (the time, `window`,
  …) in effects and event handlers, or pass them in as props, rather than while rendering.
- A small handler, one expression, goes straight in the prop:
  `onClick={() => setConfirmClear(false)}`. Anything bigger is a named `handle…` function declared
  in the component body above the JSX that uses it, like `onClick={handleClearConfirmClick}`:
  more than one statement, an `if`, or a handler several props share. A function written in a
  prop never has a `{ … }` body.
- Type a named handler's event with React's event type for that element, such as
  `MouseEvent<HTMLButtonElement>`, `ChangeEvent<HTMLInputElement>` or
  `SubmitEvent<HTMLFormElement>`, and read the element through `e.currentTarget`. Inline handlers
  are typed by their prop. Never use `FormEvent`, which React's types deprecate. In a file that
  also uses the browser's own event types (in a `window.addEventListener` callback, say), write
  those as `globalThis.MouseEvent` so they don't clash with React's.
- When an item rendered in a `.map()` has handlers of its own, make it a sub-component (like
  `BoardTab` in `top-bar/components/`).
- Don't write near-duplicate handlers. When several controls differ only in which value they
  change, make a component that takes the key instead: settings switches are
  `<SettingToggle setting="launchAtLogin" … />`, not one `handle…Change` per setting.
- Every type a component needs goes in `<name>.types.ts`: its props as `<Name>Props`, the types
  of its props (like `MenuEntry` for `Menu`'s entries) and any others, like the shape of a piece
  of state. The component file itself declares no interfaces or types. A component with no types
  has no types file.
- Top-level constants go in `<name>.constants.ts` (`.tsx` if they contain JSX), and helper
  functions in `<name>.utils.ts`. Leave out the files a component doesn't need.
- A component used only by one parent lives in that parent's `components/` folder. Components
  used in several places live in `src/renderer/src/components/`.
- Import a component's folder (`'./components/card'`), not the files inside it.

### Shared components

Use these from `@renderer/components` rather than styling the HTML element yourself. Both take an
extra `className` for layout tweaks, and pass `ref` and any other prop of the element through.

`Button`, like `<Button variant="primary" onClick={save}>Save</Button>`, is `type="button"` unless
you pass `type="submit"`, so it never submits a form by accident:

| `variant`      | Use it for                                    |
| -------------- | --------------------------------------------- |
| `default`      | Most actions (outlined)                       |
| `primary`      | The main action in a form or panel            |
| `quiet`        | Secondary actions like Cancel (no border)     |
| `danger`       | A destructive action the person has confirmed |
| `danger-quiet` | A destructive action before it's confirmed    |
| `icon`         | An icon-only button; give it an `aria-label`  |

`Input` is a text field: `<Input value={name} onChange={…} />`.

## Commits and pull requests

`main` is protected: every change goes through a pull request, and two checks must pass before
it can merge:

- `check`: typecheck, tests and build
- `title`: the pull request title follows the format below

Pull requests are squash-merged, and the title becomes the commit message on `main`, so the title
matters more than the commits on your branch. Releases are made from those titles too: they pick
the next version and become the changelog (see [Releasing](#releasing)). The title also sets the
pull request's label (`fix` → `bug`, `feat` → `enhancement`, `docs` → `documentation`, and the
type's own name for the rest, plus `breaking change` for `!`), and whoever opens a pull request is
assigned to it.

Titles follow [Conventional Commits](https://www.conventionalcommits.org), with a summary that
starts with a lowercase letter:

```
<type>(<scope>): <summary>
```

| Example                                            | When                       |
| -------------------------------------------------- | -------------------------- |
| `feat(search): filter by source app`               | A new feature              |
| `fix(shelf): keep focus in the app you were using` | A bug fix                  |
| `perf(store): load the history in pages`           | Faster or lighter          |
| `style(settings): make the top strip draggable`    | UI or styling only         |
| `refactor(store): split payloads from the index`   | Code change, same behavior |
| `test(classify): cover shell commands`             | Tests                      |
| `docs: explain Wayland shortcuts`                  | Documentation              |
| `chore: switch from npm to pnpm`                   | Tooling and config         |

The scope is optional; use the area of the app you touched (`shelf`, `settings`, `store`, `capture`,
`search`, `ci`). Add `!` after the type or scope for a breaking change (`feat(api)!: …`). If the
title doesn't fit, the `title` check says what's wrong; edit the title and it runs again.

## Testing pasting on each platform

| OS      | What to check                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------- |
| macOS   | First paste prompts for Accessibility; after allowing, Return pastes into TextEdit, Slack and a browser. |
| Windows | Return pastes into Notepad and a browser; focus returns to the app you came from.                        |
| Linux   | With `xdotool` (X11) or `wtype` (Wayland) installed, Return pastes; in a terminal it sends Ctrl+Shift+V. |

Also check that copying from a password manager is _not_ recorded, and that images and files
copied from the file manager show up with the right card.

## Releasing

Releases are automatic. [release-please](https://github.com/googleapis/release-please) keeps a
release pull request open, titled like `chore(main): release 1.1.0`, and updates it as pull
requests merge. It lists them in `CHANGELOG.md` under Features, Bug Fixes, Performance, Look and
Feel, Reverts and Documentation, and picks the next version from their titles: a `!` makes it a
major release, any `feat` a minor one, anything else in the changelog a patch. Refactors, tests,
build, CI and chores are left out of the changelog and don't start a release on their own.

When you're ready to ship, merge the release pull request. That creates a draft GitHub release
and its tag. The Release workflow then builds the installers on macOS, Windows and Linux, attaches
them to the draft, and publishes it with the changelog as its notes. It only publishes if all three
builds succeed.

To choose the version yourself, set `"release-as": "2.0.0"` on the `"."` package in
`release-please-config.json` in a pull request, and remove it after that release.

If a build fails, open the run in the Actions tab and choose **Re-run failed jobs**; the draft
stays unpublished until all three builds pass. If it needs a code change, merge the fix as a
`fix:` pull request, ship it in the next release, and delete the stuck draft from the Releases page.

Pull requests opened with the default `GITHUB_TOKEN` don't start other workflows, so the `check`
and `title` checks won't run on the release pull request by themselves. To have them run, add a
fine-grained personal access token with read and write access to Contents and Pull requests as a
`RELEASE_PLEASE_TOKEN` repository secret.

To sign builds, add `CSC_LINK` and `CSC_KEY_PASSWORD` (and for macOS notarization `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) as repository secrets.
