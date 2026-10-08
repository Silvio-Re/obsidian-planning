# AGENTS.md

Rules for agents working in this repo.

## Working-tree default

Do **not** run `git commit`, `git push`, or `git tag` unless the user explicitly asks.

Leave new or changed code in the working tree. The sanctioned commit points are:

- `npm run release` / `npm run release -- --type patch|minor|major --ver 0.5.1` (the release workflow,
  implemented by `scripts/release.mjs` — gated, idempotent, atomic)
- an explicit user request such as *"ok now do the git stuff please"* or *"release v0.x"*

When one of those is triggered, do the git work as `release.mjs` / the request intends, then
stop and report what was committed. `release.mjs` enforces the preconditions (on main, up to date,
clean tree, tests passing, no duplicate tag), so it is safe to re-run.

## Version discipline

`package.json` is the single source of truth for the version. `planning.md` is generated from
`src/` by `scripts/build.js`, and its header is stamped with `package.json`'s version. Keep all
three in sync: bump `package.json` (+ `package-lock.json`), then `npm run build`. Do not hand-edit
`planning.md`.

## Build & test

- `npm test` runs a `pretest` hook that rebuilds and syntax-validates `planning.md`, then runs the
  test suite — you always test a fresh bundle. The suite is executed by `scripts/test-runner.js`,
  which auto-discovers every `test/*.test.js|.mjs` file and spawns each as its own process,
  failing if any exits non-zero. Discovery explicitly skips `test/harness/sandbox.mjs`, the
  runner itself, and any file under `test/harness/`, so a new `test/*.test.js` file is picked up
  automatically — nothing to register. Each test file is a plain Node script (built-in `assert`;
  `process.exit(0)` on success), not a `node --test` suite.
- A read-only CI gate lives at `.github/workflows/ci.yml` (GitHub Actions; Node 20 + 22 matrix).
  It runs `npm test` **and then** `git diff --exit-code -- planning.md daily.md`, so it fails if the
  generated artifacts are out of sync with `src/`. Keep `planning.md` / `daily.md` in sync after
  changing `src/` (`npm run build`), otherwise CI fails — never commit them stale.
- After a change to `src/`, run `npm run build` so `planning.md` reflects the latest source.

### Test flakiness (known)
- `test/completed_filter.test.js` intermittently fails when the full suite runs in parallel
  (`not ok ... test/completed_filter.test.js`, generic "test failed" — a child process is killed by
  resource contention, not an assertion error). It is stable in isolation. The pressure comes from
  `test/render_bundle.test.js` (heavy resvg PNG rendering). If it flakes, re-run; do not "fix" it as
  if it were a logic bug.

## Emoji

All emoji must use `\u{XXXXXX}` escapes (see `EMOJI_REFERENCE.md` and `src/constants.js`). Never
type literal emoji, and never use 4-digit `\uXXXX` surrogate pairs.

## Rendering notes (Gantt)

- The Gantt is built as a single SVG string. Use SVG `<tspan>` for inline styling — never inject
  HTML like `<b>` inside an SVG `<text>` (it breaks rendering of subsequent rows). The execution
  list is HTML and may use `<b>`.
- `render/*.js` are DOM glue (they build strings, attach handlers, call `openTask`) and still can
  only run inside Obsidian. Their pure logic (tree building, sorting, zoom/pin math) is extracted
  into `src/render_model.js`, which imports only `constants.js` and `utils.js` — so that logic is
  now unit-testable directly, without bundling or a vm sandbox. Prefer importing `render_model.js`
  in new tests over reaching into the render modules. `render_model.js` is part of both artifacts
  (listed in `scripts/build.js`); keep its output byte-identical to before whenever you touch the
  render modules — `test/render_bundle.test.js` asserts exact HTML/SVG strings.
