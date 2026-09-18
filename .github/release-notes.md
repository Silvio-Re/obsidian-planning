Daily-note "Completed today" view
=================================

v0.5.0 adds a way to see finished tasks per day without duplicating the rendering logic, and makes
the build system emit both release files from a single description. Behavior of the dashboard itself
(the schedule, Gantt chart, capacity chart, execution order, and parsing) is unchanged.

### 📊 Dashboards
- **New daily-note view.** A bundled `daily.md` artifact now renders the **`/Projets` tasks completed
  on the day a daily note is opened**, grouped and colored exactly like the dashboard's completed
  section. It reads the note's title (its file name, `YYYY-MM-DD`) through `dv.current()` and shows a
  paste-instruction hint on non-date notes.
- **Shared tree, no duplication.** The daily view reuses the exact same `renderCompleted` module and
  the grouped project/subproject tree as the main dashboard, driven in a new `onlyDate` mode. There
  is a single source of truth for how completed tasks are grouped, styled, and folded — the dashboard
  (month range) and the daily note (single date) can never diverge.

### 🏗 Architecture
- **Shared completion parsing.** `collectAll` in `src/parser.js` no longer inlines completion-field
  extraction; it now calls a small `extractCompletedTask` helper. The daily view calls that same
  helper, so both paths agree on the completion shape.
- **Single artifacts map in `build.js`.** Release files are declared once in an `ARTIFACTS` map
  (`planning.md` dashboard + `daily.md` daily view) instead of repeated per-file logic. Building a
  new note is just a new entry in that map.
- **`renderCompleted` gains `opts.onlyDate`.** Valid date → that day; otherwise the existing month
  range. The empty-day state reuses the shared "No completed tasks found." rendering.

### 🛠 Developer Tools
- **`validate.mjs` now checks both bundled bodies** (`planning.md` and `daily.md`) so a syntax error in
  either release file is caught before it reaches Obsidian.
- **`scripts/test-runner.js`** runs the new `test/daily_notes.test.mjs` end-to-end against the bundled
  `daily.md`.
- **README** documents the new daily-note support and files.

### Changes since v0.4.2
- `src/parser.js` — shared `extractCompletedTask` helper (DRY refactor of completion parsing).
- `src/render/completed.js` — `opts.onlyDate` mode + empty-day state.
- `src/render/daily_notes.js` — new (new file).
- `src/daily_notes.js` — new daily-note entry (new file).
- `daily.md` — new bundled artifact (new file).
- `test/daily_notes.test.mjs` — new end-to-end tests (new file).
- `scripts/build.js` — single `ARTIFACTS` map, builds both artifacts.
- `scripts/validate.mjs` — validates both bundled bodies.
- `scripts/test-runner.js` — registers `test/daily_notes.test.mjs`.
- `README.md` — daily-note support + files.
- `test/build.test.js`, `test/rendering.test.js`, `test/harness/sandbox.mjs` — adapted to the artifact-based build.

---

## Release Checklist

**Naming conventions (MUST follow):**
- Git tag: `vX.Y` or `vX.Y.Z` (e.g. `v0.5`, `v0.5.0`)
- Release name: auto-generated from first line of this file
- Commit message: `<type>: description` (follow conventional commits)
- Release notes file: `.github/release-notes.md` (edit before each release)

**Before releasing:**
1. [ ] All tests pass (`npm test`)
2. [ ] Build succeeds (`npm run build`)
3. [ ] `planning.md` and `daily.md` are regenerated from latest source
4. [ ] `.github/release-notes.md` first line = release title, body = notes
5. [ ] Working tree is clean (all changes committed)
6. [ ] On `main` branch, up to date with remote

**How to release (future agents):**
```bash
# Edit .github/release-notes.md first (fill in title + notes)
# Then run (version MUST match package.json):
bash scripts/release.sh 0.5.0
```

**After releasing:**
- Commit updated release notes
- Push to main
