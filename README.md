# OpenPaste website

This branch is the published site for <https://openpaste.alexsilver.dev/>, served by GitHub Pages.

- `index.html`: the landing page
- `assets/site.js`, `assets/site.css`: the interactive layer (live shelf, search, the ⇧⌘V overlay, privacy controls)
- `privacy/`, `terms/`: the privacy policy and terms of use, styled by `assets/legal.css` and linked from every footer
- `demo/`: the browser demo, built from `main` with `pnpm demo:build`
- `assets/`: the icon, screenshot and social card

To refresh the demo after UI changes, run `pnpm demo:build` on `main` and copy `demo-dist/` over `demo/` here.
