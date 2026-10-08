Deep-review correctness pass, click-to-complete removed
=========================================================

This release lands the major and moderate findings of a deep code review:
the capacity chart becomes DST-safe and finally agrees with the scheduler's
deadline rule, the click-to-complete experiment is retired in favor of
completing tasks natively in your notes, and clicking a task whose note is
not already open now reliably selects and scrolls to its line.

### 📊 Capacity chart — DST-safe and honest about deadlines

- **No more DST drift.** Weekday detection and cumulative capacity now use
  Luxon `DateTime` objects instead of raw ISO-string arithmetic, so a
  daylight-saving transition can no longer double-count or drop a day's
  hours.
- **The chart agrees with the scheduler.** A task due on day D is owed by the
  end of D−1 (the deadline is a buffer — README rule). The demand curve now
  follows that same rule, and deficits propagate forward: once you miss,
  the chart stays red until capacity catches up. Red bars on the deadline
  columns are the last moment you can still act.
- **Custom-range rotation is DST-safe too.** Re-opening a saved custom scope
  re-uses the stored `DateTime` instead of re-deriving it from a date string,
  so the range cannot land on the wrong day after a DST change.

### ✂️ Click-to-complete removed

- The ✓ buttons (settings checkbox mode, refresh wiring, completer) are gone.
  Mark a task as done **natively**: check its `- [ ]` box in the source note,
  optionally appending `✅ YYYY-MM-DD`. It leaves the plan and shows up in
  the Completed panel on the next refresh. One less DOM-rewriting layer, and
  no risk of the completer drifting from Obsidian's own checkbox semantics.

### 🖱️ Click-to-open fixed for notes that aren't open yet

- Clicking a task used to open the note but silently fail to select/scroll to
  the line whenever that note wasn't already open in a tab — three compounding
  races (a dropped hint on retry, a 600ms give-up budget, and an ignored
  scroll state). The opener now waits for the tab to finish loading, keeps
  the handle through every retry (~3s budget for slow vaults), and passes
  Obsidian's built-in `eState` line position as a safety net.

### 🔧 Maintenance

- **Test runner auto-discovers** every `test/*.test.js|.mjs` — new test files
  are picked up automatically, no allow-list to update.
- **Pure render helpers extracted** to `src/render_model.js` (zoom anchor
  math, pins, completion-tree traversal) with direct unit tests — the
  previously untested scheduling-math core of the charts.
- The agenda summary line renders as plain text, so trend marks (`!!`, `?`)
  inside note text can no longer inject HTML.

### 🧪 Tests

- 30 test files, all green — new suites for the render model, the
  realistic deadline semantics, and the task opener's async regression.

### Changes since v0.6.1

- `src/capacity.js` — Luxon-based capacity; deadline-buffer demand rule;
  forward deficit propagation.
- `src/utils.js` — task opener: await `openFile`, hint kept on every retry,
  `eState` fallback; click-to-complete helpers removed.
- `src/render/agenda.js` — plain-text summary line.
- `src/render_model.js` — extracted pure helpers (zoom, pins, completion tree).
- `src/config.js` — DST-safe custom-range rotation.
- `scripts/test-runner.js` — auto-discovery of test files.
- `src/render/completed.js`, `daily_notes.js`, `execution_list.js` —
  completed-view glue simplified after the mode removal.
- `test/` — new `render_model` suite; `capacity`, `capacity_deadlines_realistic`,
  `task_opener` reworked; `task_completer` removed.
- `planning.md`, `daily.md` — regenerated bundles.
