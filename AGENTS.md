# AGENTS.md

Rules for agents working in this repo.

## Working-tree default

Do **not** run `git commit`, `git push`, or `git tag` unless the user explicitly asks.

Leave new or changed code in the working tree. The sanctioned commit points are:

- `scripts/release.sh <version>` (the release workflow)
- an explicit user request such as *"ok now do the git stuff please"* or *"release v0.x"*

When one of those is triggered, do the git work as `release.sh` / the request intends, then
stop and report what was committed.

## Version discipline

`package.json` is the single source of truth for the version. `planning.md` is generated from
`src/` by `scripts/build.js`, and its header is stamped with `package.json`'s version. Keep all
three in sync: bump `package.json` (+ `package-lock.json`), then `npm run build`. Do not hand-edit
`planning.md`.

## Build & test

- `npm test` runs a `pretest` hook that rebuilds and syntax-validates `planning.md`, then runs the
  test suite — you always test a fresh bundle.
- After a change to `src/`, run `npm run build` so `planning.md` reflects the latest source.

## Emoji

All emoji must use `\u{XXXXXX}` escapes (see `EMOJI_REFERENCE.md` and `src/constants.js`). Never
type literal emoji, and never use 4-digit `\uXXXX` surrogate pairs.

## Rendering notes (Gantt)

- The Gantt is built as a single SVG string. Use SVG `<tspan>` for inline styling — never inject
  HTML like `<b>` inside an SVG `<text>` (it breaks rendering of subsequent rows). The execution
  list is HTML and may use `<b>`.
- `render/*.js` are only testable through the bundled `planning.md` (they import non-exported
  helpers from `utils.js`). Test via `test/harness/sandbox.mjs`, not by importing them directly.
