Completed Tasks dashboard with an interactive From/To date-range filter

What's New in v0.4
==================

This release adds a **Completed Tasks** dashboard (rendered from the list of
`- [x]` notes in the vault) with an interactive date-range filter, plus end-to-end
render tests that drive the real module through an in-memory DOM mock.

### 📊 Dashboards
- **Completed Tasks list.** A new `src/render/completed.js` module renders every
  completed task as a line, e.g.:
  `- [x] Formulaire de demande de formation 📅 [[[2026-09-15](2026-09-15)]] ⏱ 1h ⏫ ✅ 2026-09-15`
- **Date-range filter.** Two linked fields (`From` / `To`) filter the list to tasks
  completed between two dates. Empty fields are open-ended; the range defaults to the
  current month, so the list shows this month's completed tasks by default.

### 🏗 Architecture / Rendering
- **End-to-end render testing.** `test/completed.test.js` and
  `test/completed_filter.test.js` load the built `planning.md` inside a `vm` with an
  enhanced DOM mock and exercise the real `completed.js` module — including its
  event-driven date filter — against the real `planning.md` fixture.

### 🛠 Developer Tools / Fixes
- **Sandbox mock now supports the real DOM API.** `test/harness/sandbox.mjs`:
  - `querySelectorAll` now accepts comma-separated selectors (`.a, .b`) so linked
    date fields behave like in the browser.
  - `innerHTML` assignment now resets `_children` before reparsing, so re-renders
    **replace** content instead of accumulating rows.
- **`normDate` preserves partial dates.** `src/constants.js`: a partial month/day is
  now kept as typed (`'20260'` → `'2026-0'`, `'2026-09-1'` → `'2026-09-1'`) instead of
  being dropped to `'2026'` / `'2026-09'`.

### Changes since v0.3
- Added `src/render/completed.js` (Completed Tasks dashboard + date-range filter)
- Added `test/completed.test.js` and `test/completed_filter.test.js`
- Fixed `test/harness/sandbox.mjs` comma-selector + innerHTML reset
- Fixed `normDate` partial-month/partial-day handling
- Total: **22 tests, all passing**

---

## Release Checklist

**Naming conventions (MUST follow):**
- Git tag: `vX.Y` or `vX.Y.Z` (e.g. `v0.4`, `v1.0.0`)
- Release name: auto-generated from first line of this file
- Commit message: `<type>: description` (follow conventional commits)
- Release notes file: `.github/release-notes.md` (edit before each release)

**Before releasing:**
1. [ ] All tests pass (`npm test`)
2. [ ] Build succeeds (`npm run build`)
3. [ ] `planning.md` is regenerated from latest source
4. [ ] `.github/release-notes.md` first line = release title, body = notes
5. [ ] Working tree is clean (all changes committed)
6. [ ] On `main` branch, up to date with remote

**How to release (future agents):**
```bash
# Edit .github/release-notes.md first (fill in title + notes)
# Then run:
bash scripts/release.sh 0.4
```

**After releasing:**
- Commit updated release notes
- Push to main
