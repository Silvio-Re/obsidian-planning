// test/parser.test.js - Unit tests for parser functions
// These tests use only the parsing logic, no Obsidian/Dataview dependencies
// All emoji are referenced via escape sequences from EMOJI_REFERENCE.md

import assert from 'assert';

// Import constants - these use \u{XXXXXX} escape sequences
import {
  CLOCK, CALENDAR, ID_MARKER, BLOCK_MARKER,
  PRIORITY, PRIORITY_RANK, PRIORITY_DEFAULT,
  priorityRe, durRe, dateRe, idRe, blkRe,
  parsePriority, ownDur, cleanTitle, baseName, fmtHours
} from '../src/constants.js';

// Helper to create a mock task object
function mockTask(text) {
  return { text };
}

// Test parsePriority
console.log('Testing parsePriority...');
assert.strictEqual(parsePriority(PRIORITY.P0 + ' task'), 0, 'Priority P0 should return 0');
assert.strictEqual(parsePriority(PRIORITY.P1 + ' task'), 1, 'Priority P1 should return 1');
assert.strictEqual(parsePriority(PRIORITY.P2 + ' task'), 2, 'Priority P2 should return 2');
assert.strictEqual(parsePriority(PRIORITY.P3 + ' task'), 3, 'Priority P3 should return 3');
assert.strictEqual(parsePriority(PRIORITY.P4 + ' task'), 4, 'Priority P4 should return 4');
assert.strictEqual(parsePriority('plain task'), PRIORITY_DEFAULT, 'No priority should return default (2)');
console.log('  parsePriority: PASS');

// Test ownDur
console.log('Testing ownDur...');
assert.strictEqual(ownDur(mockTask('(' + CLOCK + ':: 24h) some task')), 24, 'Should parse (CLOCK:: 24h)');
assert.strictEqual(ownDur(mockTask('(' + CLOCK + ':: 2h) task')), 2, 'Should parse (CLOCK:: 2h)');
assert.strictEqual(ownDur(mockTask('(' + CLOCK + ':: 0.5h) task')), 0.5, 'Should parse (CLOCK:: 0.5h)');
assert.strictEqual(ownDur(mockTask('(' + CLOCK + ':: 1.5h) task')), 1.5, 'Should parse (CLOCK:: 1.5h)');
assert.strictEqual(ownDur(mockTask(CLOCK + ' 24h some task')), 24, 'Should parse CLOCK 24h');
assert.strictEqual(ownDur(mockTask(CLOCK + ' 2h')), 2, 'Should parse CLOCK 2h');
assert.strictEqual(ownDur(mockTask(CLOCK + ' 0.5h')), 0.5, 'Should parse CLOCK 0.5h');
assert.strictEqual(ownDur(mockTask('no duration here')), 0, 'Should return 0 for no duration');
console.log('  ownDur: PASS');

// Test dateRe
console.log('Testing dateRe...');
const textWithDate1 = CALENDAR + ' 2024-01-15';
const textWithDate2 = CALENDAR + ' [2024-12-25 14:30]';

const match1 = textWithDate1.match(dateRe);
const match2 = textWithDate2.match(dateRe);

assert(match1 !== null, 'Should match date without time');
assert(match1[1] === '2024-01-15', 'Should capture date');
assert(match2 !== null, 'Should match date with time in brackets');
assert(match2[1] === '2024-12-25', 'Should capture date from bracket format');
assert(match2[2] === '14', 'Should capture hour');
assert(match2[3] === '30', 'Should capture minute');
console.log('  dateRe: PASS');

// Test idRe
console.log('Testing idRe...');
const idText = ID_MARKER + ' task-123';
const idMatch = idText.match(idRe);
assert(idMatch !== null, 'Should match ID');
assert(idMatch[1] === 'task-123', 'Should capture ID value');
console.log('  idRe: PASS');

// Test blkRe
console.log('Testing blkRe...');
const blkText = BLOCK_MARKER + ' dep1, dep2, dep3';
const blkMatch = blkText.match(blkRe);
assert(blkMatch !== null, 'Should match block dependencies');
assert(blkMatch[1] === 'dep1, dep2, dep3', 'Should capture dependency list');
console.log('  blkRe: PASS');

// Test cleanTitle
// In Obsidian, metadata markers appear at the END of task text
// cleanTitle removes from the first metadata char to the end of the line
console.log('Testing cleanTitle...');

// Task title with metadata at the end
const dirtyTitle1 = 'actual task title ' + CALENDAR + ' 2024-01-01';
const cleaned1 = cleanTitle(dirtyTitle1);
assert(cleaned1 === 'actual task title', `Should remove metadata from end: got "${cleaned1}"`);

// Task with priority at end
const dirtyTitle2 = 'actual task title ' + PRIORITY.P0;
const cleaned2 = cleanTitle(dirtyTitle2);
assert(cleaned2 === 'actual task title', `Should remove priority marker from end: got "${cleaned2}"`);

// Task with duration at end
const dirtyTitle3 = 'actual task ' + CLOCK + ':: 2h';
const cleaned3 = cleanTitle(dirtyTitle3);
assert(cleaned3 === 'actual task', `Should remove clock metadata from end: got "${cleaned3}"`);

// Task with multiple metadata at end
const dirtyTitle4 = 'actual task title ' + CALENDAR + ' 2024-01-01 ' + CLOCK + ':: 2h';
const cleaned4 = cleanTitle(dirtyTitle4);
assert(cleaned4 === 'actual task title', `Should remove all metadata from end: got "${cleaned4}"`);

// Task with metadata at start (should also work since pattern matches from first metadata char)
const dirtyTitle5 = CALENDAR + ' 2024-01-01 actual task title';
const cleaned5 = cleanTitle(dirtyTitle5);
assert(cleaned5 === '', `Should remove from first metadata to end: got "${cleaned5}"`);

// Task with multiple spaces
const dirtyTitle6 = 'actual  task  with  spaces ' + CALENDAR + ' 2024-01-01';
const cleaned6 = cleanTitle(dirtyTitle6);
assert(cleaned6 === 'actual task with spaces', `Should normalize spaces: got "${cleaned6}"`);

// Task with only metadata (edge case)
const dirtyTitle7 = CALENDAR + ' 2024-01-01';
const cleaned7 = cleanTitle(dirtyTitle7);
assert(cleaned7 === '', `Should return empty for only metadata: got "${cleaned7}"`);

// Task with no metadata
const dirtyTitle8 = 'actual task title';
const cleaned8 = cleanTitle(dirtyTitle8);
assert(cleaned8 === 'actual task title', `Should keep title with no metadata: got "${cleaned8}"`);
console.log('  cleanTitle: PASS');

// Test baseName
console.log('Testing baseName...');
assert.strictEqual(baseName('Projets/task.md'), 'task', 'Should extract base name');
assert.strictEqual(baseName('Projets/sub/task.md'), 'task', 'Should extract base name from nested path');
assert.strictEqual(baseName('file'), 'file', 'Should handle name without extension');
console.log('  baseName: PASS');

// Test fmtHours
console.log('Testing fmtHours...');
assert.strictEqual(fmtHours(24), '24', 'Should format whole hours without decimal');
assert.strictEqual(fmtHours(24.0), '24', 'Should format whole hours without decimal');
assert.strictEqual(fmtHours(2.5), '2.5', 'Should format decimal hours');
assert.strictEqual(fmtHours(0.5), '0.5', 'Should format small decimal hours');
console.log('  fmtHours: PASS');

// Test priorityRe directly
console.log('Testing priorityRe...');
const p0Text = PRIORITY.P0 + ' task';
const p0Match = p0Text.match(priorityRe);
assert(p0Match !== null, 'Should match P0');
assert(p0Match[1] === PRIORITY.P0, 'Should capture P0 character');

const p1Text = PRIORITY.P1 + ' task';
const p1Match = p1Text.match(priorityRe);
assert(p1Match !== null, 'Should match P1');
assert(p1Match[1] === PRIORITY.P1, 'Should capture P1 character');
console.log('  priorityRe: PASS');

// Test unknown-dependency detection in collectAll
// collectAll uses the global `dv` only for dv.date(); mock it with native Dates.
console.log('Testing collectAll unknown-dependency warnings...');

globalThis.dv = { date: (s) => { const d = new Date(s + 'T00:00:00Z'); return isNaN(d.getTime()) ? null : d; } };
const { collectAll } = await import('../src/parser.js');

const dvTask = (text, line, extra = {}) => ({ text, line, status: ' ', completed: false, subtasks: [], ...extra });
const ID = ID_MARKER, BLK = BLOCK_MARKER, CAL = CALENDAR, CLK = CLOCK;

// Unknown dep (typo) -> warning listing the unknown id
{
  const pages = [{ file: { path: 'Projets/p.md', tasks: [
    dvTask(`Implement login ${ID} auth-module ${CLK} 3h ${CAL} 2025-01-20`, 1),
    dvTask(`Write tests ${BLK} auth-moduel ${CLK} 2h ${CAL} 2025-01-21`, 2),
  ] } }];
  const { warnings } = collectAll(pages);
  assert.strictEqual(warnings.length, 1, 'typo dep produces exactly one warning');
  assert.strictEqual(warnings[0].line, 2, 'warning points at the dependent task');
  assert(warnings[0].errors.some(e => e.includes('Unknown dependency') && e.includes('auth-moduel')), 'warning names the unknown id');
}

// Mixed deps: one known, one unknown -> single warning naming only the unknown one
{
  const pages = [{ file: { path: 'Projets/p.md', tasks: [
    dvTask(`Implement login ${ID} auth-module ${CLK} 3h ${CAL} 2025-01-20`, 1),
    dvTask(`Deploy ${BLK} auth-module, api-gateway ${CLK} 1h ${CAL} 2025-01-22`, 2),
  ] } }];
  const { warnings } = collectAll(pages);
  assert.strictEqual(warnings.length, 1, 'mixed deps produce one warning');
  assert(warnings[0].errors.some(e => e.includes('api-gateway') && !e.includes('auth-module,')), 'only the unknown dep is named');
}

// Valid deps: forward reference (dep before target in file order), cross-page, and
// duplicate-id targets must NOT warn
{
  const pages = [
    { file: { path: 'Projets/a.md', tasks: [
      dvTask(`Tests ${BLK} impl ${CLK} 2h ${CAL} 2025-01-21`, 1),
    ] } },
    { file: { path: 'Projets/b.md', tasks: [
      dvTask(`Implement ${ID} impl ${CLK} 3h ${CAL} 2025-01-20`, 1),
      dvTask(`Implement v2 ${ID} impl ${CLK} 1h ${CAL} 2025-01-25`, 2),
    ] } },
  ];
  const { warnings } = collectAll(pages);
  assert.strictEqual(warnings.length, 0, 'forward/cross-page/duplicate-id deps do not warn');
}

// Dep on a completed or cancelled task -> warning (stale reference; the scheduler
// can never satisfy it since finished/cancelled work is not scheduled)
{
  const pages = [{ file: { path: 'Projets/p.md', tasks: [
    { text: `Old design ${ID} design ${CLK} 2h`, line: 1, status: 'x', completed: true, subtasks: [] },
    dvTask(`Build feature ${BLK} design ${CLK} 3h ${CAL} 2025-01-20`, 2),
  ] } }];
  const { warnings } = collectAll(pages);
  assert.strictEqual(warnings.length, 1, 'dep on completed task warns');
  assert(warnings[0].errors.some(e => e.includes('Unknown dependency')), 'names it as unknown');
}

// Dep target defined on a subtask -> known, no warning (file.tasks may be nested)
{
  const pages = [{ file: { path: 'Projets/p.md', tasks: [
    { text: `Parent ${CLK} 4h ${CAL} 2025-01-20`, line: 1, status: ' ', completed: false,
      subtasks: [dvTask(`Child ${ID} sub-id ${CLK} 1h`, 2)] },
    dvTask(`Other ${BLK} sub-id ${CLK} 1h ${CAL} 2025-01-21`, 3),
  ] } }];
  const { warnings } = collectAll(pages);
  assert.strictEqual(warnings.length, 0, 'subtask id counts as a known dep target');
}

// Task with no deps at all -> never warns
{
  const pages = [{ file: { path: 'Projets/p.md', tasks: [
    dvTask(`Plain task ${CLK} 1h ${CAL} 2025-01-20`, 1),
  ] } }];
  const { warnings } = collectAll(pages);
  assert.strictEqual(warnings.length, 0, 'no deps -> no warning');
}

console.log('  collectAll unknown-dependency warnings: PASS');

// A meeting (locked task) whose date fails to parse must NOT become a lock — the
// scheduler and renderers assume lk.day is a valid DateTime and would crash the
// whole dashboard. The parsing-error panel already flags it with the reason.
console.log('Testing collectPlannerData invalid-meeting-date handling...');
// collectPlannerData needs Luxon DateTimes from dv.date (as Dataview returns them).
const { DateTime } = await import('luxon');
globalThis.dv = { date: (s) => { const d = DateTime.fromISO(s); return d.isValid ? d : null; } };
const { collectPlannerData } = await import('../src/parser.js');
{
  const pages = [{ file: { path: 'Projets/p.md', tasks: [
    // regex-valid but semantically invalid date (month 13, day 45) -> dv.date returns null
    dvTask(`Bad meeting ${CAL} 2025-13-45 14:00 ${CLK} 1h`, 1),
    dvTask(`Good task ${CLK} 2h ${CAL} 2025-01-20`, 2),
    dvTask(`Good meeting ${CAL} 2025-01-15 14:00 ${CLK} 1h`, 3),
  ] } }];
  const { items, locks, warnings } = collectPlannerData(pages);
  assert.strictEqual(locks.length, 1, 'only the well-dated meeting becomes a lock');
  assert.strictEqual(locks[0].title, 'Good meeting', 'bad-date meeting is excluded from locks');
  assert.strictEqual(items.length, 1, 'regular task unaffected');
  assert(warnings.some(w => w.line === 1 && w.errors.some(e => e.includes('Date parse failed'))),
    'bad-date meeting is flagged in the parsing warnings');
  // the produced locks must be schedulable without crashing (this used to throw
  // TypeError: Cannot read properties of null)
  const { computeSchedule } = await import('../src/scheduler.js');
  const today = DateTime.fromISO('2025-01-06');
  const s = computeSchedule(items, locks, today, { startHour: 9, hoursPerDay: 8 });
  assert.strictEqual(s.sched.length, 1, 'schedule computes fine with the filtered locks');
  assert.strictEqual(s.meetData.length, 1, 'one meeting on the schedule');
}
console.log('  collectPlannerData invalid-meeting-date: PASS');

console.log('\nAll parser tests passed!');
process.exit(0);

// --- Additional parser test coverage ---
console.log('Testing additional parser edge cases...');

// Test priorityRe with multiple emoji in text
const multiPrio = PRIORITY.P0 + ' high ' + PRIORITY.P3 + ' low';
const pMatch = multiPrio.match(priorityRe);
assert(pMatch !== null, 'multi-priority text matches');
assert.strictEqual(pMatch[1], PRIORITY.P0, 'matches first priority');

// Test parsePriority returns correct default
assert.strictEqual(parsePriority(''), PRIORITY_DEFAULT, 'empty string => default');
assert.strictEqual(parsePriority(' '), PRIORITY_DEFAULT, 'whitespace => default');
assert.strictEqual(parsePriority('P0 P1 P2'), PRIORITY_DEFAULT, 'text P0 not emoji => default');

// Test ownDur with various formats
assert.strictEqual(ownDur(mockTask(CLOCK + ' 1h')), 1, '⏱ 1h');
assert.strictEqual(ownDur(mockTask(CLOCK + ' 100h')), 100, '⏱ 100h');
assert.strictEqual(ownDur(mockTask('some text ' + CLOCK + ' 2h')), 2, 'text before clock');
assert.strictEqual(ownDur(mockTask('(' + CLOCK + ':: 0.33h)')), 0.33, '(⏱:: 0.33h)');
assert.strictEqual(ownDur(mockTask('(⏱:: 12.5h) more text')), 12.5, '(⏱:: 12.5h) with suffix');

// Test dateRe edge cases
const dExtra1 = (CALENDAR + ' 2024-01-01 14:30').match(dateRe);
assert(dExtra1 !== null, 'date with space-separated time matches');
assert.strictEqual(dExtra1[1], '2024-01-01', 'captures date');
assert.strictEqual(dExtra1[2], '14', 'captures hour');
assert.strictEqual(dExtra1[3], '30', 'captures minute');

// Test cleanTitle with multiple emojis
const dirtyExtra = 'hello ' + PRIORITY.P0 + ' ' + CLOCK + ':: 2h ' + CALENDAR + ' 2024-01-01';
const cleanedExtra = cleanTitle(dirtyExtra);
assert.strictEqual(cleanedExtra, 'hello', 'removes all metadata from first emoji onward');

// Test cleanTitle with emoji in title text
const emojiTitle = 'task with ' + PRIORITY.P2 + ' inside';
const cleanedExtra2 = cleanTitle(emojiTitle);
assert.strictEqual(cleanedExtra2, 'task with ', 'emoji in middle removes rest');

// Test fmtHours precision
assert.strictEqual(fmtHours(0.33), '0.3', 'one decimal');
assert.strictEqual(fmtHours(0.333), '0.3', 'truncated to 1 decimal');
assert.strictEqual(fmtHours(999), '999', 'large whole');
assert.strictEqual(fmtHours(999.9), '999.9', 'large decimal');

// Test baseName with various extensions
assert.strictEqual(baseName('path.md'), 'path');
assert.strictEqual(baseName('path/extra.md'), 'extra');

console.log('  Additional parser: PASS');
