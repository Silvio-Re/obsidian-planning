// test/completed.test.js - Unit tests for completed ([x]) task collection + line formatting.
// collectAll uses only dv.date (a global) for UNDONE tasks; the completed branch is pure, so we
// provide a tiny dv mock. formatCompletedLine is a pure constants function.

import assert from 'assert';
import { DateTime } from 'luxon';
import { collectAll } from '../src/parser.js';
import {
  CALENDAR, CLOCK, CHECK, PRIORITY, PRIORITY_RANK, formatCompletedLine,
  completionRe,
} from '../src/constants.js';

// Minimal dv mock (date only; used by the undone-task branch).
globalThis.dv = { date: (s) => (s === 'today' ? DateTime.fromISO('2026-09-15') : DateTime.fromISO(s)) };

console.log('Testing completed-task collection (collectAll)…\n');

const pages = [
  { file: { path: 'Projets/Formation.md', tasks: [
    { line: 1, completed: true, status: 'x', text: 'Formulaire de demande de formation ' + CALENDAR + ' 2026-09-15 ' + CLOCK + ' 1h ' + PRIORITY.P1 + ' ' + CHECK + ' 2026-09-15' },
    { line: 2, completed: false, status: ' ', text: 'Active task ' + ID('ta') + CALENDAR + ' 2026-09-20 ' + CLOCK + ' 2h' },
    { line: 3, completed: true, status: 'x', text: 'Tache sans date ni duree ' + CHECK + ' 2026-09-14' },
    { line: 4, completed: false, status: '-', text: 'Cancelled task' },
  ] } },
  { file: { path: 'Projets/Other.md', tasks: [
    { line: 9, completed: true, status: 'x', text: 'Second done ' + CALENDAR + ' 2026-08-01 ' + CLOCK + ':: 0.5h ' + CHECK + ' 2026-08-02' },
  ] } },
];

function ID(id) { return '\u{1F194} ' + id; }

const { all, completed } = collectAll(pages);

// Cancelled (status '-') tasks are skipped; the active (undone) task lands in `all`, not `completed`.
assert.strictEqual(completed.length, 3, 'should collect 3 completed tasks');
assert.strictEqual(all.length, 1, 'only the 1 undone task should be scheduled');

const byTitle = (t) => completed.find((c) => c.title === t);

// Task 1 — full metadata, P1.
const c1 = byTitle('Formulaire de demande de formation');
assert(c1, 'formulaire task collected');
assert.strictEqual(c1.dlStr, '2026-09-15', 'deadline date parsed from 📅');
assert.strictEqual(c1.hours, 1, 'duration parsed (1h)');
assert.strictEqual(c1.priority, 1, 'priority P1 parsed from ⏫');
assert.strictEqual(c1.compDate, '2026-09-15', 'completion date parsed from ✅');
assert.strictEqual(c1.path, 'Projets/Formation.md', 'path captured');
assert.strictEqual(c1.line, 1, 'line captured');

// Task 3 — no date, no duration, default priority.
const c3 = byTitle('Tache sans date ni duree');
assert(c3, 'task without date/duration collected');
assert.strictEqual(c3.dlStr, null, 'no deadline => null');
assert.strictEqual(c3.hours, 0, 'no duration => 0');
assert.strictEqual(c3.priority, 2, 'no priority => default P2');
assert.strictEqual(c3.compDate, '2026-09-14', 'completion date parsed from ✅');

// Other file, duration in (CLOCK:: 0.5h) form.
const c4 = byTitle('Second done');
assert(c4, 'task from other file collected');
assert.strictEqual(c4.dlStr, '2026-08-01', 'deadline parsed');
assert.strictEqual(c4.hours, 0.5, 'duration parsed from (CLOCK:: 0.5h)');
assert.strictEqual(c4.compDate, '2026-08-02', 'completion date parsed');

console.log('  collectAll completed: PASS\n');

// --- formatCompletedLine ---
console.log('Testing formatCompletedLine…');

const expected1 = '- [x] Formulaire de demande de formation ' + CALENDAR + ' [[[2026-09-15](2026-09-15)]] ' + CLOCK + ' 1h ' + PRIORITY.P1 + ' ' + CHECK + ' 2026-09-15';
assert.strictEqual(formatCompletedLine(c1), expected1, 'full metadata line matches the requested format');

const expected3 = '- [x] Tache sans date ni duree ' + PRIORITY.P2 + ' ' + CHECK + ' 2026-09-14';
assert.strictEqual(formatCompletedLine(c3), expected3, 'minimal line (no date/duration)');

// Direct call: the canonical example from the request.
const example = { title: 'Formulaire de demande de formation', dlStr: '2026-09-15', hours: 1, priority: PRIORITY_RANK[PRIORITY.P1], compDate: '2026-09-15' };
assert.strictEqual(formatCompletedLine(example), '- [x] Formulaire de demande de formation ' + CALENDAR + ' [[[2026-09-15](2026-09-15)]] ' + CLOCK + ' 1h ' + PRIORITY.P1 + ' ' + CHECK + ' 2026-09-15', 'canonical example');

// No priority marker at all -> default P2 emoji.
const noPrio = formatCompletedLine({ title: 'Only done', compDate: '2026-01-01' });
assert.strictEqual(noPrio, '- [x] Only done ' + PRIORITY.P2 + ' ' + CHECK + ' 2026-01-01', 'default priority shown');

console.log('  formatCompletedLine: PASS\n');

// --- completionRe ---
console.log('Testing completionRe…');
assert.strictEqual((CHECK + ' 2026-09-15').match(completionRe)[1], '2026-09-15', 'simple ✅ date');
assert.strictEqual((CHECK + '[2026-09-15]').match(completionRe)[1], '2026-09-15', 'bracketed date');
assert.strictEqual((CHECK + '   2026-09-15').match(completionRe)[1], '2026-09-15', 'loose spacing');
assert(!completionRe.test('no marker here'), 'no marker => no match');
console.log('  completionRe: PASS\n');

console.log('All completed tests passed!');
process.exit(0);
