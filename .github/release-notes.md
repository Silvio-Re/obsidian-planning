Out-of-working-hours meetings keep their requested date

What's New in v0.4.1
====================

Previously, a meeting scheduled **outside** working hours (e.g. `📅 2026-09-23 17:30 ⏱ 4h`
when the working day ends at 17:00) was rolled onto the **next** calendar day — both in the
ordered execution list and in the Gantt. This release keeps the meeting on the date the user
actually requested.

### 🗓 Scheduling
- **Meetings keep their requested date.** A meeting outside working hours now appears on its
  own requested calendar day in the execution list instead of being pushed to the next day.
  In-hours and straddling meetings are unchanged (a straddling meeting still reserves only its
  in-hours portion).
- **Gantt:** the meeting bar now extends visually past the working day into the next working
  day, while the **first task of the next working day still starts at 09:00** — the two simply
  overlap, which is fine.
- **Scheduling is unaffected.** Only in-hours meeting time is locked against tasks, so task
  placement (deadlines, EDF order) behaves exactly as before.

### 🛠 Developer Tools
- **Testable execution sequence.** Built the execution sequence (tasks + meetings) in a new
  `src/execution_sequence.js` module instead of inline in `src/index.js`, and wired
  `src/render/execution_list.js` to use it. Meetings now carry their requested date
  (`meetDateStr`) so the execution list groups them correctly.
- **New tests.** Added `test/execution_sequence.test.js` (6 cases: pre-hours, post-hours,
  in-hours, straddling, "does not push the next day", and execution-list grouping).
- **Build.** `scripts/build.js` now bundles `src/execution_sequence.js`.

### Changes since v0.4
- `src/scheduler.js` — un-clamp a meeting's display position into its own working day for the
  Gantt; still clamp only in-hours time into the meeting lock.
- `src/execution_sequence.js` — new, testable execution-sequence builder.
- `src/index.js`, `src/render/execution_list.js` — use the extracted builder.
- `test/execution_sequence.test.js` — new suite; `scripts/build.js`, `scripts/test-runner.js`
  wired for it.
- Total: **23 tests, all passing**.

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
# Then run:
bash scripts/release.sh 0.4.1
```

**After releasing:**
- Commit updated release notes
- Push to main
