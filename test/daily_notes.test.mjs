// test/daily_notes.test.mjs — end-to-end tests for the daily-note "Completed today" view.
//
// Two things are verified:
//   1. The bundled daily.md dashboard (rendered via the shared renderCompleted tree in onlyDate
//      mode) shows only the /Projets tasks completed on the daily note's date, grouped by project,
//      reusing the SAME grouped tree as the main dashboard (single source of truth).
//   2. extractCompletedTask (the pure helper shared by both the dashboard and the daily view)
//      parses completion metadata in the expected shape.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runBundleDaily, findCompleted, walkTree } from './harness/sandbox.mjs';
import { extractCompletedTask } from '../src/parser.js';
import { CALENDAR, CLOCK, CHECK, PRIORITY, PRIORITY_RANK } from '../src/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Save a rendered daily tree to test/output/ for visual debugging (best-effort; never fails a test).
function writeArtifact(name, html) {
  try {
    const dir = path.join(__dirname, 'output');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), html);
  } catch (_) {}
}

console.log('Testing daily-note "Completed today" view (bundled daily.md)…\n');

const pages = [
  { file: { path: 'Projets/Formation.md', tasks: [
    { line: 1, completed: true, status: 'x', text: 'Formulaire ' + CALENDAR + ' 2026-09-15 ' + CLOCK + ' 1h ' + PRIORITY.P1 + ' ' + CHECK + ' 2026-09-15' },
    { line: 2, completed: true, status: 'x', text: 'Done yesterday ' + CHECK + ' 2026-09-14' },
    { line: 3, completed: false, status: ' ', text: 'Pending task ' + CALENDAR + ' 2026-09-20 ' + CLOCK + ' 2h' },
  ] } },
  { file: { path: 'Projets/Budget.md', tasks: [
    { line: 1, completed: true, status: 'x', text: 'Budget approved ' + CLOCK + ' 3h ' + CHECK + ' 2026-09-15' },
  ] } },
];

// --- (a) Filtered to a day that has completions: show only that day's tasks, grouped by project.
console.log('  daily note 2026-09-15 (partial-day filter)…');
{
  const root = runBundleDaily(pages, { today: '2026-09-15', dailyTitle: '2026-09-15' });
  const html = findCompleted(root);
  assert.ok(html, 'completed tree rendered for a dated daily note');

  // Both projects are shown (group headers carry the project basename).
  assert.ok(html.includes('Formation'), 'Formation group shown');
  assert.ok(html.includes('Budget'), 'Budget group shown');
  // The two tasks completed on 2026-09-15 appear with their hours.
  assert.ok(html.includes('Formulaire (1h)'), 'Formation task (completed today) shown');
  assert.ok(html.includes('Budget approved (3h)'), 'Budget task (completed today) shown');
  // Completion date appended to each task row.
  assert.ok(html.includes('✅ 2026-09-15'), 'completion date shown on task rows');
  assert.ok(html.includes('crow'), 'task rows carry crow class');

  // Tasks completed on OTHER days (or never completed) are excluded.
  assert.ok(!html.includes('Done yesterday'), 'yesterday completion excluded from today');
  assert.ok(!html.includes('Pending task'), 'undone task excluded');

  // Header rendered by the daily entry.
  let sawHeader = false;
  walkTree(root, (el) => { if (el.text === 'Completed today') sawHeader = true; });
  assert.ok(sawHeader, '"Completed today" header rendered');

  writeArtifact('daily-notes.html', html);
  console.log('    PASS');
}

// --- (b) Filtered to a valid day with NO completions: show the empty state.
console.log('  daily note 2026-09-13 (no completions that day)…');
{
  const root = runBundleDaily(pages, { today: '2026-09-13', dailyTitle: '2026-09-13' });
  const html = findCompleted(root);
  assert.ok(html, 'completed section still rendered');
  assert.ok(html.includes('No completed tasks found.'), 'empty state shown for a day with no completions');
  assert.ok(!html.includes('crow'), 'no task rows rendered on an empty day');
  console.log('    PASS');
}

// --- (c) Filtered to a day with completions but the note title is not a date: show the hint.
console.log('  daily note "not-a-date" (not a dated note)…');
{
  const root = runBundleDaily(pages, { today: '2026-09-15', dailyTitle: 'not-a-date' });
  const completed = findCompleted(root);
  assert.strictEqual(completed, null, 'no completed tree rendered for a non-dated note');
  let hint = null;
  walkTree(root, (el) => {
    const blob = el.text || el.innerHTML || '';
    if (!hint && blob.includes('Paste this block into a dated daily note')) hint = blob;
  });
  assert.ok(hint, 'hint text shown for a non-dated note');
  console.log('    PASS');
}

// --- (d) Empty when the /Projets pages have no completed tasks at all.
console.log('  daily note with no completed tasks anywhere…');
{
  const emptyPages = [
    { file: { path: 'Projets/Pure.md', tasks: [
      { line: 1, completed: false, status: ' ', text: 'Only active ' + CALENDAR + ' 2026-09-21 ' + CLOCK + ' 1h' },
    ] } },
  ];
  const root = runBundleDaily(emptyPages, { today: '2026-09-15', dailyTitle: '2026-09-15' });
  const html = findCompleted(root);
  assert.ok(html, 'completed section rendered');
  assert.ok(html.includes('No completed tasks found.'), 'empty state shown when nothing is completed');
  console.log('    PASS');
}

console.log('\nTesting extractCompletedTask (shared pure helper)…\n');

const t = extractCompletedTask({
  text: 'Formulaire de demande de formation ' + CALENDAR + ' 2026-09-15 ' + CLOCK + ' 1h ' + PRIORITY.P1 + ' ' + CHECK + ' 2026-09-15',
  path: 'Projets/Formation.md', file: 'Formation', line: 7,
});
assert.strictEqual(t.title, 'Formulaire de demande de formation', 'title stripped of metadata');
assert.strictEqual(t.dlStr, '2026-09-15', 'deadline parsed from 📅');
assert.strictEqual(t.hours, 1, 'duration parsed from ⏱ 1h');
assert.strictEqual(t.priority, PRIORITY_RANK[PRIORITY.P1], 'priority parsed from ⏫ (rank)');
assert.strictEqual(t.compDate, '2026-09-15', 'completion date parsed from ✅');
assert.strictEqual(t.path, 'Projets/Formation.md', 'path captured');
assert.strictEqual(t.line, 7, 'line captured');

// The shared helper output matches exactly the shape collectAll() pushes into the completion log,
// so the dashboard and the daily view agree on what "completed" means.
const expectedShape = {
  title: t.title, path: t.path, file: 'Formation', line: t.line,
  dlStr: t.dlStr, hours: t.hours, priority: t.priority, compDate: t.compDate,
};
assert.deepStrictEqual(t, expectedShape, 'extractCompletedTask shape matches the shared completion shape');
console.log('  extractCompletedTask: PASS\n');

console.log('All daily-notes tests passed!');
process.exit(0);
