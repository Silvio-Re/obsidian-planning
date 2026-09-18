Idempotent gated release command
=================================

v0.5.1 replaces the brittle multi-step `scripts/release.sh` with a single, gated, idempotent, atomic
release command. It also removes the old release script and its documentation references, so the
release path is one well-defined workflow instead of three places to keep in sync. Behavior of the
plugin itself (dashboard, schedule, Gantt, capacity, daily-note view) is unchanged.

### 📦 Release tooling
- **New `scripts/release.mjs`** — one command (`npm run release`) that gates, builds, and releases.
- **Atomic** — regenerated artifacts, the `package.json` version bump, and release notes go into ONE
  commit that is then tagged and pushed; the tag can no longer point at a tree that lacks source.
- **Idempotent** — refuses if `vX.Y.Z` already exists locally or on GitHub; no duplicate releases.
- **Gated (fail-fast)** — verifies you are on `main`, up to date with `origin/main`, have a clean
  tree, and `npm test` passes *before* any commit/tag/push is made; aborts with a one-line message.
- **Never force-pushes** — the gates forbid a dirty/behind tree, so push is always a clean
  fast-forward and the tag is always new.
- **`--dry-run`** — runs all gates + build, prints the plan, and stops with no side effects.

### Changes since v0.5.0
- `scripts/release.mjs` — gated, idempotent, atomic release CLI (new file).
- `scripts/release.sh` — removed (see "Why" below).
- `package.json` — added `release` and `release:dry` npm scripts.
- `README.md`, `AGENTS.md`, `.github/release-notes.md` — point at `npm run release`.

### Why the old `release.sh` was removed
`release.sh` staged only `planning.md`, so its release commit could point at a tree that omitted the
feature source (forcing a force-push to fix). It also doubled the version prefix in the commit message
(`chore: release vv0.5.0`) and produced no gates, so a half-finished state could still be released.
`release.mjs` fixes all three: full-tree commit, correct `v${next}` tag, and pre-flight gates.

---

## Release Checklist

**Naming conventions (MUST follow):**
- Git tag: `vX.Y` or `vX.Y.Z` (e.g. `v0.5.1`)
- Release name: auto-generated from the first line of this file
- Commit message: `chore: release v${VERSION}` (generated automatically — do not edit)
- Release notes file: `.github/release-notes.md` (edit before each release)

**Before releasing:**
1. [ ] All tests pass (`npm test`)
2. [ ] The new feature has been tested in Obsidian / bundled `planning.md` + `daily.md` looks right
3. [ ] `.github/release-notes.md` first line = release title, body = notes
4. [ ] Working tree is clean (all changes committed)
5. [ ] On `main` branch, up to date with `origin/main`

**How to release (future agents):**
```bash
npm run release                 # bump minor from package.json
npm run release -- --type patch # bump patch | minor | major
npm run release -- --ver 0.5.1  # explicit version
npm run release -- --dry-run    # validate gates + build, no side effects
```
`package.json` is the source of truth for the version; the script computes the next version.

**After releasing:**
- The release script prints the release URL and leaves `package.json` synced.
- No manual commit or push is needed — `release.mjs` does it all.
