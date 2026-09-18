Release ships both artifacts; notes are pure changelog
=======================================================

This release fixes the release tooling itself (nothing in the plugin changed). The plugin's
daily-note "Completed today" feature from v0.5.1 is unchanged here.

### Release tooling
- **📦 Both bundled artifacts now ship.** `scripts/release.mjs` uploads `planning.md` *and*
  `daily.md` to the GitHub release, so the daily-note artifact is not left out of a release.
- **📝 Release notes are now pure changelog.** `.github/release-notes.md` contains only the release
  description (its first line is the release title). The Release Checklist moved to the README's
  release section, since it is developer/agent workflow — not release content.

### Changes since v0.5.1
- `scripts/release.mjs` — attach both `planning.md` and `daily.md` to the GitHub release.
- `.github/release-notes.md` — changelog only; release checklist removed.
- `README.md` — Release Checklist under the Release section.
- `AGENTS.md` — points to the README Release section instead of inlining the checklist.
