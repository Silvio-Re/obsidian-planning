Scheduler correctness: dependency order enforced, dashboard crash fixes
========================================================================

This release fixes several scheduling and rendering correctness bugs found in a deep
code review, and hardens the build/release pipeline.

### 📅 Scheduling

- **⛔ Dependencies are now actually enforced.** The scheduler's ready-check compared
  dependency IDs against `path:line` keys, so they never matched: any task with a
  dependency fell through to a fallback that ignored deadlines and dependency order
  (e.g. `Tests ⛔ impl` could run before `Implement 🆔 impl`, and urgent dependents
  ran after unrelated later-deadline work). The scheduled set now tracks both forms.
- **Priority correction no longer violates dependencies.** When the correction loop
  locked a high-priority late task, locked items are allocated first — which placed
  the task before its own dependencies. Locking now pulls the task's dependency
  closure in, ancestors first.
- **Deadline-day buffer documented as intended.** A deadline counts from midnight of
  its date: work scheduled on the deadline's date is late by definition — the day
  itself is a review/slippage buffer (README > Deadline).

### 📊 Dashboards

- **A meeting with an unparseable date no longer crashes the whole dashboard.**
  `- [ ] meeting 📅 2025-13-45 14:00` used to throw and kill every panel; it is now
  excluded from the schedule and flagged in the parsing-errors panel.
- **Unknown dependency IDs are surfaced.** A typo'd `⛔ auth-moduel` (or a dep on
  a completed/cancelled task) now shows a parsing warning instead of silently
  scheduling the task as if it had no constraint.
- **Clicking a task row now selects the task line** in the opened file — for left
  click and middle click alike. The opened leaf is used as a hint so the selection
  survives the asynchronous view load; an already-open leaf is preferred.

### 🛠 Developer Tools

- **Bundler no longer corrupts strings containing "export"/"import".** Import/export
  stripping is line-anchored only; the previous mid-line pass rewrote the keywords
  inside string literals.
- **Release script:** the tag gate now also checks the remote (`git ls-remote`), so a
  tag that exists on GitHub but wasn't fetched can no longer lead to a half-done
  release; the full test suite re-runs on the rebuilt bundle before the release commit.
- 25 test files (all green), including new regression tests for every fix above.

### Changes since v0.5.3

- `src/scheduler.js` — dep-ID tracking in the scheduled set; dep-closure locking in the
  priority-correction loop; lateness-rule docblock.
- `src/parser.js` — unknown-dependency warnings; invalid-date locks excluded.
- `src/utils.js` — leaf-hint line selection for click/auxclick task openers.
- `scripts/build.js` — line-anchored import/export stripping.
- `scripts/release.mjs` — remote tag gate; post-bump test run.
- `README.md` — deadline-buffer semantics.
- `test/` — regression tests: `dependency_order`, `scheduler_advanced`, `parser`,
  `build`, new `task_opener.test.js` (registered in `scripts/test-runner.js`).
- `planning.md`, `daily.md` — regenerated bundles.
