Today agenda, click-to-complete, at-risk panel, scheduling fixes
================================================================

This release brings the planner's most actionable view to the top of the dashboard,
adds one-click completion, and hardens scheduling correctness after two deep
reviews. It also answers the question "what should I do now?" at a glance.

### 📅 Today agenda — the new first panel

- **One panel for today's plan.** Scheduled task segments and meetings that land
  on today, in true chronological order with real clock times, at the very top
  of the dashboard. Meetings show the time as written in the note — an 18:00
  dinner sync says 18:00 even when it falls outside working hours.
- **Early-morning meetings sort correctly.** An 08:00 meeting now precedes a
  09:00 task (both used to clamp to the same start position); an after-hours
  meeting stays last on its own day instead of rolling into the next.

### ✓ Click-to-complete

- **Every agenda and execution-list row carries a ✓ button.** Clicking it
  flips the task's checkbox (`- [ ]` → `- [x]`) **and** appends the ✅
  completion date marker, so the task leaves the plan on the next refresh and
  shows up in the Completed panel and the daily-note view. Double clicks are
  no-ops; the row's own click-to-open still works.
- **The parsing-error guard:** a meeting with an invalid time (e.g. `99:00`)
  is no longer scheduled — it drew a bar outside its Gantt day box and printed
  a nonsense agenda time. It is flagged in the parsing-errors panel instead.

### 📊 At-risk panel

- **On time but with almost no slack.** Tasks whose positive slack margin is
  thinner than a quarter working day, sorted worst-first, in their own panel.
  Late tasks are excluded — they are already flagged by the lateness
  indicators.

### 📈 Dashboards & config

- **`USER_CONFIG` block** at the top of the script: folders, start hour, hours
  per day and non-working days (holidays, vacation) are configurable without
  touching the logic. Non-working days carry zero capacity and are shaded in
  the charts.
- **Daily-note view honors `USER_CONFIG`** — the "completed today" daily.md
  script uses the same folder list and filters to the note's date.
- **Gantt finish dates**: group rows show finish dates computed from the
  schedule, and late meetings render red (consistent across Gantt and agenda).

### 🔧 Scheduling fixes

- **Completion marker no longer breaks duration parsing.** The completer
  used to append a marker that the parser then misread; durations are now
  parsed strictly from the task text.
- **Slack horizon widened.** The work-day horizon now extends past the
  farthest deadline, so slack (at-risk) computations are no longer silently
  truncated for far-future deadlines.

### 🧪 Tests

- 29 test files, all green — including new regression tests for every fix
  above (true-clock ordering, invalid-time exclusion, slack horizon, completer
  semantics).

### Changes since v0.5.4

- `src/execution_sequence.js` — true-clock sort keys (`sortDay`/`sortFrac`);
  meetings keep requested-date grouping.
- `src/agenda.js` — today-agenda selector.
- `src/render/agenda.js`, `src/render/execution_list.js` — agenda panel;
  ✓ done-buttons on rows.
- `src/utils.js` — `makeTaskCompleter` (atomic checkbox flip + ✅ marker via
  `vault.process`), `wireDoneButtons`.
- `src/risk.js`, `src/render/risk.js` — at-risk slack computation and panel.
- `src/parser.js` — invalid-time meetings excluded from locks.
- `src/scheduler.js` — deadline-aware work-day horizon.
- `src/config.js`, `src/render/capacity_chart.js` — `USER_CONFIG` and
  non-working-day shading.
- `test/` — new `agenda`, `task_completer` suites and extended coverage.
- `planning.md`, `daily.md` — regenerated bundles.
