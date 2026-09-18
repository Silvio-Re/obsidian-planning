Versioning tooling, AGENTS.md, and a leaner README

What's New in v0.4.2
====================

v0.4.2 does not change the dashboard's behavior — the schedule, Gantt, capacity chart, execution
order, and parsing are identical to **v0.4.1**. It tidies up how the project is versioned and
documented, so future releases are safer and easier.

### 🛠 Versioning Tooling
- **`package.json` is the single source of truth for the version.** It is the only place the
  version is declared; `planning.md`'s header is stamped from it on every build.
- **`release.sh` now guards the version.** The release argument must match `package.json` exactly;
  a mismatch fails immediately — before tests, commit, or release — instead of silently creating
  or overwriting the wrong tag. This prevents the classic `release.sh 0.4` when the intended tag
  was `v0.4.1`.

### 📄 Documentation
- **`AGENTS.md` added.** Records the working-tree convention (do not commit/push/tag unless asked;
  `release.sh` and explicit "git stuff"/release requests are the sanctioned points) plus version
  discipline, emoji-escape rules, and the Gantt SVG gotchas.
- **README rewritten.** Leaner and easier to scan; the reference (task syntax, markers, scheduling,
  output) is unchanged.

### Changes since v0.4.1
- `package.json`, `package-lock.json` — version is the single declared source.
- `scripts/release.sh` — version guard against tag/version drift.
- `AGENTS.md` — new agent conventions.
- `README.md` — streamlined; `scripts/build.js` entry added to the source tree list.
- `.github/release-notes.md.template` — example tag/version updated to `v0.4` / `v0.4.1`.

---

## Release Checklist

**Naming conventions (MUST follow):**
- Git tag: `vX.Y` or `vX.Y.Z` (e.g. `v0.4`, `v0.4.1`)
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
# Then run (version MUST match package.json):
bash scripts/release.sh 0.4.2
```

**After releasing:**
- Commit updated release notes
- Push to main
