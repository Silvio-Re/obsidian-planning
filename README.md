# obsidian-planning

A DataviewJS-based planning dashboard for Obsidian. Turns task lists with emoji metadata into a
visual schedule with capacity analysis, a Gantt chart, and an execution-order list.

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

### Priority

P0–P4, from highest (`🔺`) to lowest (`⏬`). No priority specified → defaults to **P2**.

```markdown
- [ ] Review PR ⏱ 2.5h 🔺
- [ ] Write unit tests ⏱ 4h ⏫
```

### Deadline

The date by which the task should be finished. A deadline with a time (`YYYY-MM-DD HH:MM`)
becomes a **locked task** — a hard, unmovable block in the schedule (e.g. a meeting). Locked tasks
consume capacity on their day but are never scheduled to a different time.

```markdown
- [ ] Sprint planning 📅 2025-01-20 14:00 ⏱ 1h 🔽
```

**On purpose:** the deadline date itself is a buffer, not usable working time. A task is on time
only if it finishes by midnight *before* its deadline — i.e. by end of the previous working day.
Any work scheduled to land on the deadline's date is flagged late. This reserves the deadline day
for review and slippage instead of planning work into it.

### Dependencies

Mark a task as depending on another task's ID. The scheduler places the dependency first.

```markdown
- [ ] Implement login 🆔 auth-module ⏱ 3h 🔺
- [ ] Write login tests ⛔ auth-module ⏱ 2h 🔺
```

Dependencies create a **priority inheritance** chain: a dependent task inherits the highest
priority of everything it depends on. Deadlines propagate down the chain too — if a dependent has
an earlier deadline, it becomes the effective deadline for its dependency.

## Scheduling

The planner uses **Earliest Deadline First (EDF)**:

- **Work hours**: 9:00–17:00 weekdays, 8h/day (configurable in `SCHEDULE_CONFIG`)
- **Single resource**: only one task runs at a time
- **Meetings are fixed**: locked tasks occupy hard blocks
- **Priority correction**: if a high-priority task would be late, it is locked to an earlier slot
  and the schedule is recomputed

## Output Dashboard

1. **Capacity Chart** — cumulative hours owed vs. weekday capacity. Red bars = inherited deadlines;
   click a column to see which tasks must be cleared.
2. **Gantt Chart** — visual schedule grouped by file/folder, collapsible groups, dependency arrows,
   late tasks color-coded.
3. **Execution List** — ordered, what-to-do-next with times. Click any row to open the source task.
4. **Ignored Tasks** — undone tasks with no effective deadline (review, correct, or delete).
5. **Completed Tasks** — finished (`- [x]`) tasks as a foldable tree by project/subproject, with a
   From/To date-range filter (defaults to the current month). Copy the same block into a dated daily
   note (`YYYY-MM-DD`) to see only the tasks completed that day.

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
  scheduler.js          — EDF scheduling with priority correction
  capacity.js           — Hours owed vs. available
  execution_sequence.js — Build the execution-order list
  render/
    capacity_chart.js   — SVG capacity chart with zoom/pan
    gantt.js            — SVG Gantt chart with collapsible tree
    execution_list.js   — Ordered execution plan
    ignored.js          — Undeclared tasks
    parsing_errors.js   — Malformed metadata
    completed.js        — Foldable project tree of finished tasks (single source of truth)
    daily_notes.js      — "Completed today" view for daily-note templates
  index.js              — Main orchestrator (dashboard entry)
  daily_notes.js        — Daily-note entry (filters the same tree to the note's date)
test/                   — Parsing, scheduling, capacity, dependency, build, and render tests
  harness/sandbox.mjs   — DOM mock + bundle runner shared by the render tests
scripts/
  build.js              — Bundles src/**/*.js into planning.md
  validate.mjs          — node --check on every src file + the bundled planning.md and daily.md bodies
  test-runner.js        — Runs all tests
  release.mjs           — Gated, idempotent, atomic release CLI (see "Release" below)
```

### Build & Test

```bash
npm test          # test + build (pretest rebuilds and syntax-validates planning.md)
npm run build     # regenerate planning.md
npm run dev       # test + build
```

The build reads `src/` in dependency order, inlines `import`/`export`, deduplicates declarations,
and wraps the result in a ` ```dataviewjs ` block. `npm test` runs a `pretest` hook that rebuilds
`planning.md` and syntax-validates it, so you always test a fresh bundle — never a stale one.

### Release

`package.json` is the single source of truth for the version. Edit `.github/release-notes.md`
first (title + notes), then:

```bash
npm run release                 # bump minor (package.json is source of truth)
npm run release -- --type patch # bump patch | minor | major
npm run release -- --ver 0.5.1  # explicit version
npm run release -- --dry-run    # run all gates + build, print the plan, stop (no side effects)
```

`npm run release` is gated, idempotent, and atomic: it verifies you are on `main`, up to date with
`origin/main`, have a clean tree, and that `npm test` passes *before* touching anything, then makes
a single release commit (regenerated artifacts + the `package.json` bump) that it tags and pushes —
never force-pushing, and refusing if the tag already exists. Edit `.github/release-notes.md` first
(the first non-empty line is the release title).

#### Release checklist

- [ ] Tests pass: `npm test`
- [ ] Working tree is clean (commit feature work first, or use `--allow-dirty`)
- [ ] You are on `main` and up to date with `origin/main`
- [ ] `.github/release-notes.md` first line = release title, body = changelog (release notes are *only* the changelog — agent workflow belongs in the README/AGENTS.md)
- [ ] Both bundled artifacts (`planning.md` and `daily.md`) build cleanly
- [ ] Run `npm run release -- --dry-run` to preview the plan with no side effects
- [ ] Review the plan, then run `npm run release -- --type <patch|minor>`, and verify the tag + GitHub release carry both assets

> Tip: before tagging, build each artifact and paste it into a live note (e.g. `daily.md` into a
> dated daily note) to confirm the rendering before it is shipped.

### Adding a Feature

1. Add/extend a test in `test/`.
2. Add logic to the relevant `src/` module.
3. `npm test` (rebuilds + validates via `pretest`) — all must pass.
4. `npm run build` — `planning.md` is regenerated.
5. Paste `planning.md` into an Obsidian note and verify.

### Gotchas

- **SVG vs. HTML namespaces.** The Gantt is one SVG string. Never inject HTML into an SVG
  `<text>` element — `<b>LATE</b>` makes the browser's SVG parser swallow every following row.
  Use SVG `<tspan>` for inline styling; keep `<b>` only in the execution-list panel (HTML `div`s).
- **Render modules are only testable via the bundle.** `render/*.js` import non-exported helpers
  from `utils.js` that only exist after `build.js` inlines them. Use `test/harness/sandbox.mjs` to
  run the bundled `planning.md` against fake pages — importing them directly fails.
- **The dashboard renders nothing with zero regular tasks.** `index.js` only renders when
  `items.length` is non-zero, so render-test fixtures must include at least one regular task.
