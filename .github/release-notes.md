v0.2 — Modular architecture with test suite and build system

What's New in v0.2
==================

Major refactor from a single monolithic `planning.md` into modular, testable ES modules with a full 18-file test suite.

### 🏗 Architecture
- **Split** `planning.md` into 11 ES modules under `src/` (constants, parser, scheduler, capacity, utils, 5 renderers)
- **Custom bundler** (`scripts/build.js`) resolves imports, deduplicates declarations, outputs flat `planning.md`
- **18 test files** (1,077 lines) covering parser, scheduler, graph, capacity, build pipeline, rendering, edge cases — all passing

### 📅 Scheduling
- **EDF (Earliest Deadline First)** with topological sort respecting dependency order
- **Priority inversion correction**: iteratively locks late high-priority tasks and recomputes
- **Priority inheritance**: dependent tasks inherit the highest priority from their dependency chain
- **Transitive deadlines**: deadlines propagate down dependency chains

### 📊 Dashboards
- **Capacity chart**: cumulative hours owed vs weekday capacity, interactive zoom/pan, click deadlines for task details
- **Gantt chart**: collapsible tree grouping by file/folder, dependency arrows, late-task color coding
- **Execution list**: ordered plan with clickable rows opening source tasks
- **Ignored tasks**: undated tasks flagged for review

### 🛠 Developer Tools
- `npm test` — run all 18 tests
- `npm run build` — bundle into `planning.md`
- `npm run dev` — test + build
- `package.json` with proper scripts
- `.gitignore` for `node_modules/`

### Changes since v0.1
- `README.md` expanded with full documentation (task format, scheduling, setup)
- `src/scheduler.js` — priority inversion correction, meeting slot handling
- `scripts/test-runner.js` — multi-file test runner
- `planning.md` rebuilt from modular sources (1,473 lines)
