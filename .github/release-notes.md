Late-meeting detection with faithful SVG render previews

What's New in v0.3
==================

This release adds late-meeting detection to the scheduler and renderer, plus a new end-to-end
render test suite that validates the generated Gantt SVG and execution-list HTML against fake
Obsidian pages.

### 🏗 Architecture
- **Late-meeting detection.** A meeting whose prerequisite tasks are all scheduled after today
  (i.e. its dependencies are late) is flagged `displayLate` in `src/scheduler.js`. The flag is
  threaded through parsing (`src/parser.js`) into the Gantt (`src/render/gantt.js`) and execution
  list (`src/render/execution_list.js`).
- **New syntax-validation gate.** `scripts/validate.mjs` runs `node --check` on every source file
  and on the bundled `planning.md` body, wired into the `pretest` hook so `npm test` always tests a
  fresh, syntax-valid bundle.
- **Render test harness.** `test/harness/sandbox.mjs` provides a DOM mock and a bundle runner so
  the render modules (which import non-exported `utils.js` helpers only present after the build)
  can be exercised end-to-end.

### 📅 Scheduling
- **Late meetings** are scheduled by Earliest Deadline First but rendered distinctly: their Gantt
  bar is red (`rgb(224,108,117)`), the execution-list row is colored by priority with a red
  background, and the label shows a bold **LATE** marker.

### 📊 Dashboards
- **Gantt SVG correctness.** Late-meeting labels use the SVG-correct `<tspan font-weight="bold">`
  for the LATE marker instead of an HTML `<b>` — injecting `<b>` inside an SVG `<text>` element
  breaks the browser's SVG parser and wipes out every row after it. The render test asserts no
  `<b>` leaks into the SVG.
- **Render previews.** The render test writes each fixture's generated SVG/HTML to `test/output/`
  and a faithful PNG rasterization (via `@resvg/resvg-js`, full `<tspan>`/CSS support) to
  `test/output/png/` for visual inspection.

### 🛠 Developer Tools
- **New tests.** `test/render_bundle.test.js` (end-to-end render, 5 tests) and
  `test/late_meeting_deps.test.js` (scheduler late-meeting detection) — 20 tests total, all passing.
- `npm test` — run all 20 tests (also rebuilds + syntax-validates via `pretest`).
- `npm run build` — bundle into `planning.md`.

### Changes since v0.2
- `src/scheduler.js` — `displayLate` flag for meetings with late prerequisites
- `src/parser.js` — locked tasks now carry their effective priority
- `src/render/gantt.js` — red bar + `<tspan>` LATE label for late meetings
- `src/render/execution_list.js` — priority-colored red rows + LATE marker for late meetings
- `src/index.js` — passes `displayLate`/`priority` into the execution sequence
- `scripts/validate.mjs` — new syntax gate (bundled into `pretest`)
- `test/harness/sandbox.mjs`, `test/render_bundle.test.js`, `test/late_meeting_deps.test.js` — new
- `test/test-runner.js` — registers the new test files
- `README.md` — Developer section updated (structure, gotchas, render previews)
- `planning.md` — rebuilt from source

---
## Release Checklist

**Naming conventions (MUST follow):**
- Git tag: `vX.Y` or `vX.Y.Z` (e.g. `v0.3`)
- Release name: auto-generated from first line of this file
- Commit message: `<type>: description` (follow conventional commits)
- Release notes file: `.github/release-notes.md` (edit before each release)

**Before releasing:**
1. [x] All tests pass (`npm test`)
2. [x] Build succeeds (`npm run build`)
3. [x] `planning.md` is regenerated from latest source
4. [x] `.github/release-notes.md` first line = release title, body = notes
5. [x] Working tree is clean (all changes committed)
6. [x] On `main` branch, up to date with remote

**How to release (future agents):**
```bash
# Edit .github/release-notes.md first (fill in title + notes)
# Then run:
bash scripts/release.sh 0.3
```

**After releasing:**
- Commit updated release notes
- Push to main
