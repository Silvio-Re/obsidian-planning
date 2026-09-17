# obsidian-planning

A DataviewJS-based planning dashboard for Obsidian. Turns task lists with emoji metadata into a visual schedule with capacity analysis, Gantt charts, and execution ordering.

## Setup

1. Create a folder named `Projets` in your vault (or update the query in `index.js`).
2. Add task notes inside that folder.
3. Place the contents of `planning.md` into a note where you want the dashboard to appear.

## Task Format

Tasks are Obsidian task lines (`- [ ]`) with emoji-based metadata embedded in the text.

### Metadata Markers

| Emoji | Name | Syntax | Example |
|-------|------|--------|---------|
| 🔺–⏬ | Priority | *(emoji alone)* | `- [ ] Review architecture doc 🔺` |
| ⏱ | Duration | `⏱ Nh` | `- [ ] Implement feature ⏱ 4h` |
| 📅 | Deadline | `📅 YYYY-MM-DD` (optional time) | `- [ ] Fix auth bug 📅 2025-01-15` |
| 🆔 | ID | `🆔 task-id` | `- [ ] Implement login 🆔 auth-module` |
| ⛔ | Dependency | `⛔ dep-id` | `- [ ] Write tests ⛔ auth-module` |

### Priority Levels

| Priority | Emoji | Meaning |
|----------|-------|---------|
| P0 | 🔺 | Highest — urgent, critical path |
| P1 | ⏫ | High — should be done first |
| P2 | 🔼 | Medium — default priority |
| P3 | 🔽 | Low — can be deferred |
| P4 | ⏬ | Lowest — do when free |

If no priority is specified, tasks default to **P2**.

### Duration

Specify work hours needed to complete the task. Supports fractions.

```markdown
- [ ] Review PR ⏱ 2.5h 🔺
- [ ] Write unit tests ⏱ 4h ⏫
```

### Deadline

The date by which the task should be finished.

```markdown
- [ ] Fix auth bug 📅 2025-01-15 🔺
```

#### Locked Tasks (Meetings)

A deadline with a time (`YYYY-MM-DD HH:MM`) becomes a **locked task** — a hard block in the schedule that cannot be moved.

```markdown
- [ ] Sprint planning 📅 2025-01-20 14:00 ⏱ 1h 🔽
```

Locked tasks consume capacity on their day but are **not scheduled** — they occupy a fixed slot.

### Dependencies

Mark a task as depending on another task's ID. The scheduler will place the dependency first.

```markdown
- [ ] Implement login 🆔 auth-module ⏱ 3h 🔺
- [ ] Write login tests ⛔ auth-module ⏱ 2h 🔺
```

Dependencies create a **priority inheritance** chain: a dependent task inherits the highest priority of all tasks it depends on. Deadlines also propagate down the chain — if a dependent has an earlier deadline, it becomes the effective deadline for the dependency.

## Scheduling

The planner uses **Earliest Deadline First (EDF)** scheduling:

- **Work hours**: 9:00–17:00 weekdays, 8h/day (configurable in `SCHEDULE_CONFIG`)
- **Single resource**: only one task runs at a time
- **Meetings are fixed**: locked tasks occupy hard blocks
- **Priority correction**: if high-priority tasks would be late, they are locked to earlier slots and the schedule recomputed

### Output Dashboard

The dashboard renders four sections:

1. **Capacity Chart** — cumulative hours owed vs. weekday capacity. Red bars = inherited deadlines. Click a deadline column to see which tasks must be cleared.
2. **Gantt Chart** — visual schedule grouped by file/folder. Collapsible groups, dependency arrows, late tasks color-coded.
3. **Execution List** — ordered list of what to do and when. Click any row to open the source task.
4. **Ignored Tasks** — undone tasks with no effective deadline (review, correct, or delete).
5. **Completed Tasks** — log of finished (`- [x]`) tasks, rendered as a **foldable tree** by project/subproject at the very end of the dashboard. It is a near-exact copy of the Gantt chart's first column: group headers (folder icon) carry the **cumulative hours** of every task under them (including nested subprojects), and each task row shows `title (hours)h` plus the completion date parsed from the `✅` marker:
   `▾ 📁 Formation (3.5h)` → `▾ 📄 Recrutement (1h)` → `Tests unitaires (1h) ✅ 2026-09-15`
   Branches fold/unfold with the ▸/▾ markers (or "fold all" / "unfold all"); click any row to open the source task.
   Only finished tasks that carry a completion date (`✅ YYYY-MM-DD`) are listed; undone tasks and finished-but-undated ones are skipped.
   A **From / To** date range at the top filters the tree by completion date (inclusive, day granularity); it defaults to the **current month** (From = 1st, To = last day). Clearing a field resets it to the current month.

### Visual Indicators

| Color | Meaning |
|-------|---------|
| Blue | On schedule |
| Red (P0–P1) | Late, highest priority |
| Orange (P2) | Late, medium priority |
| Gray (P3–P4) | Late, low priority |
| Purple | Locked task (meeting) |
| Yellow row | Planning (aggregate view) |

## Developer

### Project Structure

```
src/
  constants.js          — Emoji constants, regex patterns, parsing helpers
  utils.js              — HTML escaping, markdown rendering, openTask
  parser.js             — Collect tasks from Obsidian pages, build dependency graph
  scheduler.js          — EDF scheduling algorithm with priority correction
  capacity.js           — Capacity calculation (hours owed vs. available)
  render/
    capacity_chart.js   — SVG capacity chart with zoom/pan
    gantt.js            — SVG Gantt chart with collapsible tree
    execution_list.js   — Ordered execution plan
    ignored.js          — Undeclared tasks
    parsing_errors.js   — Malformed metadata
    completed.js        — Foldable project tree of finished ([x]) tasks (Gantt first-column layout)
  index.js              — Main orchestrator
test/                   — 21 test files covering parsing, scheduling, capacity, and end-to-end render
  harness/
    sandbox.mjs         — DOM mock + bundle runner shared by the render tests
scripts/
  build.js              — Bundles src/**/*.js into planning.md
  validate.mjs          — node --check on every src file + the bundled planning.md body
  test-runner.js        — Runs all tests
```

### Build

```bash
npm test          # Run all tests
npm run build     # Bundle into planning.md
npm run dev       # test + build
npm run check     # same as build
```

The build process:
1. Reads all `src/` files in dependency order
2. Resolves `import`/`export` statements (inlines dependencies)
3. Deduplicates top-level declarations
4. Wraps the result in a ` ```dataviewjs ` code block → `planning.md`

### Testing

20 test files cover:
- Parser (metadata extraction, date parsing, duration)
- Scheduler (EDF, priority inversion correction, locked tasks, late-meeting detection)
- Dependency graph (inheritance, transitive deadlines)
- Capacity calculation (meetings, cumulative deficit)
- Build pipeline (idempotency, output integrity)
- Edge cases (real-world data, malformed input)
- End-to-end render (bundled `planning.md` executed against fake pages; Gantt SVG + execution HTML)

`npm test` runs a `pretest` hook first: it rebuilds `planning.md`, then runs
`scripts/validate.mjs` (`node --check` on every source file and the bundled body). You therefore
always test a fresh, syntax-valid bundle — never a stale one.

```bash
npm test
# → 20 passed, 0 failed
```

**Render previews.** The end-to-end render test (`test/render_bundle.test.js`) writes the generated
artifacts of each fixture to `test/output/` for inspection:

- `test/output/*.svg` — the raw Gantt SVG and execution-list HTML (string/diff inspection).
- `test/output/png/*.png` — faithful rasterizations of each Gantt SVG, rendered with `resvg-js`
  (full `<tspan>`/CSS support, so the bold **LATE** label and row colors render correctly).

These are regenerated on every `npm test`. Open the PNGs to visually verify the Gantt.

### Adding a Feature

1. Write or extend a test in `test/`.
2. Add logic to the appropriate `src/` module.
3. Run `npm test` — all tests must pass (this also rebuilds and syntax-validates via `pretest`).
4. Run `npm run build` — `planning.md` is regenerated.
5. Place `planning.md` contents into an Obsidian note and verify in Obsidian.

### Gotchas

- **SVG vs. HTML namespaces.** The Gantt is built as one SVG string. Never inject HTML markup into
  an SVG `<text>` element — `<b>LATE</b>` inside `<text>` makes the browser's SVG parser swallow every
  row after it and render them as plain text (no colored bars). Use the SVG-correct `<tspan>` for inline
  styling; keep `<b>` only in the execution-list panel, which is HTML `<div>` content.
- **Render modules can only be tested via the bundle.** `render/*.js` import non-exported helpers from
  `utils.js` (`esc`, `clip`, `renderMd`, `openTask`), which only exist after `build.js` inlines them.
  Use `test/harness/sandbox.mjs` to run the bundled `planning.md` against fake pages and assert on the
  generated SVG/HTML — importing the modules directly will fail.
- **The dashboard renders nothing with zero regular tasks.** `index.js` only renders when `items.length`
  is non-zero, so render-test fixtures must contain at least one regular (non-meeting) task.
