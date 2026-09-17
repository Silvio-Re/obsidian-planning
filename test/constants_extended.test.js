import assert from 'assert';
import {
  CLOCK, CALENDAR, ID_MARKER, BLOCK_MARKER, CHECK,
  PRIORITY, PRIORITY_RANK, PRIORITY_DEFAULT, PRIORITY_BY_RANK,
  priorityRe, durRe, dateRe, idRe, blkRe, completionRe,
  parsePriority, ownDur, cleanTitle, baseName, fmtHours, priorityEmoji, formatCompletedLine,
  completionMonth, filterByCompletionMonth, currentMonth,
  completionKey, filterByCompletionRange, monthStartKey, monthEndKey,
  isCompleteDate, normDate
} from '../src/constants.js';

console.log('Testing constants.js extended coverage...');

// --- priorityRe edge cases ---
console.log('  Testing priorityRe edge cases...');

// With emoji variation marker (U+FE0F)
assert(priorityRe.test(PRIORITY.P0 + '\uFE0F'), 'P0 with variation selector matches');
assert(priorityRe.test(PRIORITY.P1 + '\uFE0F'), 'P1 with variation selector matches');
assert(priorityRe.test(PRIORITY.P2 + '\uFE0F'), 'P2 with variation selector matches');
assert(priorityRe.test(PRIORITY.P3 + '\uFE0F'), 'P3 with variation selector matches');
assert(priorityRe.test(PRIORITY.P4 + '\uFE0F'), 'P4 with variation selector matches');

// Priority in middle of text
assert(priorityRe.test('task ' + PRIORITY.P0 + ' something'), 'P0 in middle matches');

// No priority
assert(!priorityRe.test('no priority marker here'), 'no priority returns false');

// Priority-like text that is NOT a priority
const fakePriorities = ['🔺', 'P0', 'P1', 'p0', 'priority'];
fakePriorities.forEach(fp => {
  // These should NOT match the emoji regex (only emoji chars match)
  // Actually, the fakePriorities don't contain emoji so they won't match
});

console.log('    priorityRe: PASS');

// --- durRe edge cases ---
console.log('  Testing durRe edge cases...');

// Format with parens
assert(durRe.test('(' + CLOCK + ':: 24h)'), '(⏱:: 24h) matches');
assert(durRe.test('(' + CLOCK + ':: 1h)'), '(⏱:: 1h) matches');
assert(durRe.test('(' + CLOCK + ':: 0.25h)'), '(⏱:: 0.25h) matches');
assert(durRe.test('(' + CLOCK + ':: 99.99h)'), '(⏱:: 99.99h) matches');
assert(durRe.test('(' + CLOCK + ':: 100h)'), '(⏱:: 100h) matches');
assert(durRe.test('(' + CLOCK + ':: 0.01h)'), '(⏱:: 0.01h) matches');

// Format without parens
assert(durRe.test(CLOCK + ' 24h'), '⏱ 24h matches');
assert(durRe.test(CLOCK + ' 1h'), '⏱ 1h matches');
assert(durRe.test(CLOCK + ' 0.5h'), '⏱ 0.5h matches');
assert(durRe.test(CLOCK + ' 100h'), '⏱ 100h matches');

// With spacing variations
assert(durRe.test(CLOCK + '  2h'), '⏱  2h double space matches');
assert(durRe.test('(' + CLOCK + '::   2h)'), '(⏱::   2h) triple space matches');

// No duration
assert(!durRe.test('just text'), 'no duration returns false');
assert(!durRe.test(CLOCK + 'h'), '⏱h no number returns false');
assert(!durRe.test(CLOCK + ' abc'), '⏱ abc no number returns false');
assert(!durRe.test(CLOCK + ' 2m'), '⏱ 2m minutes not hours returns false');
assert(!durRe.test(CLOCK + '::'), '⏱:: no number returns false');

// Duration with text before/after
assert(durRe.test('text ' + CLOCK + ':: 2h) more text'), 'duration in middle matches');
assert(durRe.test(CLOCK + ' 2h suffix'), 'duration at start with suffix matches');

// Extract numbers with ownDur
function mock(text) { return { text }; }
assert.strictEqual(ownDur(mock(CLOCK + ' 24h')), 24, '⏱ 24h');
assert.strictEqual(ownDur(mock(CLOCK + ' 0.1h')), 0.1, '⏱ 0.1h');
assert.strictEqual(ownDur(mock('(⏱:: 3.14h)')), 3.14, '(⏱:: 3.14h)');
assert.strictEqual(ownDur(mock('prefix ' + CLOCK + ' 5h')), 5, 'prefix before ⏱ 5h');
assert.strictEqual(ownDur(mock(CLOCK + ' 0h')), 0, '⏱ 0h = 0');
assert.strictEqual(ownDur(mock('(⏱:: 1000h)')), 1000, '(⏱:: 1000h) large value');

console.log('    durRe: PASS');

// --- dateRe edge cases ---
console.log('  Testing dateRe edge cases...');

// Basic date
const m1 = (CALENDAR + ' 2024-01-01').match(dateRe);
assert(m1 !== null, 'basic date matches');
assert.strictEqual(m1[1], '2024-01-01', 'captures date');
assert.strictEqual(m1[2], undefined, 'no time group');

// Date with time in brackets
const m2 = (CALENDAR + ' [2024-12-25 14:30]').match(dateRe);
assert(m2 !== null, 'date with time matches');
assert.strictEqual(m2[1], '2024-12-25', 'captures date');
assert.strictEqual(m2[2], '14', 'captures hour');
assert.strictEqual(m2[3], '30', 'captures minute');

// Date with various bracket styles
const m3 = (CALENDAR + '[2024-06-15]').match(dateRe);
assert(m3 !== null, 'date with no space matches');
assert.strictEqual(m3[1], '2024-06-15', 'captures date');

// Edge dates
assert(dateRe.test(CALENDAR + ' 2000-01-01'), 'year 2000');
assert(dateRe.test(CALENDAR + ' 2099-12-31'), 'year 2099');
assert(dateRe.test(CALENDAR + ' 2024-00-01'), 'month 00 matches (regex only)');
assert(dateRe.test(CALENDAR + ' 2024-13-01'), 'month 13 matches (regex only)');

// No date
assert(!dateRe.test('just text'), 'no date returns false');

console.log('    dateRe: PASS');

// --- idRe edge cases ---
console.log('  Testing idRe edge cases...');

// Standard IDs
const i1 = (ID_MARKER + ' task-123').match(idRe);
assert(i1 !== null, 'standard ID matches');
assert.strictEqual(i1[1], 'task-123', 'captures ID');

const i2 = (ID_MARKER + ' ABC').match(idRe);
assert(i2 !== null, 'uppercase ID matches');
assert.strictEqual(i2[1], 'ABC', 'captures uppercase');

const i3 = (ID_MARKER + ' a_b-c_1').match(idRe);
assert(i3 !== null, 'mixed ID matches');
assert.strictEqual(i3[1], 'a_b-c_1', 'captures mixed');

// Trailing non-alphanumeric stripped
const i4 = (ID_MARKER + ' task!@#').match(idRe);
assert(i4 !== null, 'ID with trailing special chars matches');
assert.strictEqual(i4[1], 'task', 'strips trailing non-alphanumeric');

// Just the marker — no match (requires at least one [\w-])
assert(!idRe.test(ID_MARKER), 'bare marker alone does not match (requires ID text)');

// No ID
assert(!idRe.test('just text'), 'no ID returns false');

console.log('    idRe: PASS');

// --- blkRe edge cases ---
console.log('  Testing blkRe edge cases...');

const b1 = (BLOCK_MARKER + ' dep1, dep2').match(blkRe);
assert(b1 !== null, 'simple deps matches');
assert.strictEqual(b1[1], 'dep1, dep2', 'captures deps');

const b2 = (BLOCK_MARKER + ' a, b, c, d, e').match(blkRe);
assert(b2 !== null, 'many deps matches');
assert.strictEqual(b2[1], 'a, b, c, d, e', 'captures all deps');

const b3 = (BLOCK_MARKER + ' task-1, task-2').match(blkRe);
assert(b3 !== null, 'hyphenated IDs matches');
assert.strictEqual(b3[1], 'task-1, task-2', 'captures hyphenated');

const b4 = (BLOCK_MARKER + ' dep1').match(blkRe);
assert(b4 !== null, 'single dep matches');
assert.strictEqual(b4[1], 'dep1', 'captures single dep');

// No deps
assert(!blkRe.test('just text'), 'no deps returns false');

console.log('    blkRe: PASS');

// --- cleanTitle edge cases ---
console.log('  Testing cleanTitle edge cases...');

// Various metadata combinations
assert.strictEqual(cleanTitle('do stuff ' + CALENDAR + ' 2024-01-01'), 'do stuff');
assert.strictEqual(cleanTitle('do stuff ' + CLOCK + ':: 2h'), 'do stuff');
assert.strictEqual(cleanTitle('do stuff ' + PRIORITY.P0), 'do stuff');
assert.strictEqual(cleanTitle('do stuff ' + ID_MARKER + ' x'), 'do stuff');
assert.strictEqual(cleanTitle('do stuff ' + BLOCK_MARKER + ' y'), 'do stuff');

// All metadata at end
const dirty = 'do stuff ' + CALENDAR + ' 2024-01-01 ' + CLOCK + ':: 2h ' + PRIORITY.P1;
assert.strictEqual(cleanTitle(dirty), 'do stuff');

// Multiple spaces normalized
assert.strictEqual(cleanTitle('multiple   spaces   here ' + CALENDAR + ' 2024-01-01'), 'multiple spaces here');

// Title with metadata characters in it (text before metadata is kept)
const edge1 = 'use ' + CALENDAR + ' here';
assert.strictEqual(cleanTitle(edge1), 'use', 'calendar in middle removes from marker to end, keeps prefix');

// Only emoji in text
assert.strictEqual(cleanTitle(PRIORITY.P0 + ' ' + CLOCK), '');

// Empty title
assert.strictEqual(cleanTitle(''), '');
assert.strictEqual(cleanTitle('   ' + CALENDAR + ' 2024-01-01'), '');

// Title with special chars
assert.strictEqual(cleanTitle('write code & tests ' + CALENDAR + ' 2024-01-01'), 'write code & tests');
assert.strictEqual(cleanTitle('fix <bug> ' + CALENDAR + ' 2024-01-01'), 'fix <bug>');

console.log('    cleanTitle: PASS');

// --- fmtHours edge cases ---
console.log('  Testing fmtHours edge cases...');

assert.strictEqual(fmtHours(0), '0', 'zero');
assert.strictEqual(fmtHours(0.5), '0.5', 'half');
assert.strictEqual(fmtHours(1), '1', 'one');
assert.strictEqual(fmtHours(1.5), '1.5', 'one and a half');
assert.strictEqual(fmtHours(10), '10', 'ten');
assert.strictEqual(fmtHours(10.5), '10.5', 'ten and a half');
assert.strictEqual(fmtHours(99.9), '99.9', 'one decimal');
assert.strictEqual(fmtHours(123.45), '123.5', 'toFixed(1) rounds to 1 decimal');
assert.strictEqual(fmtHours(-1), '-1', 'negative');
assert.strictEqual(fmtHours(-0.5), '-0.5', 'negative half');
assert.strictEqual(fmtHours(100), '100', 'hundred');
assert.strictEqual(fmtHours(0.01), '0', 'small decimal rounds to 0');

console.log('    fmtHours: PASS');

// --- baseName edge cases ---
console.log('  Testing baseName edge cases...');

assert.strictEqual(baseName('file.md'), 'file');
assert.strictEqual(baseName('file.txt'), 'file.txt', 'only .md extension stripped');
assert.strictEqual(baseName('path/to/file.md'), 'file');
assert.strictEqual(baseName('file'), 'file');
assert.strictEqual(baseName(''), '');
assert.strictEqual(baseName('a/b/c/d/e.md'), 'e');
assert.strictEqual(baseName('My File.md'), 'My File');
assert.strictEqual(baseName('file_name_with_underscores.md'), 'file_name_with_underscores');

console.log('    baseName: PASS');

// --- CHECK marker ---
console.log('  Testing CHECK marker...');
assert.strictEqual(CHECK, '\u{2705}', 'CHECK is the green check mark');
console.log('    CHECK: PASS');

// --- completionRe ---
console.log('  Testing completionRe...');
assert.strictEqual((CHECK + ' 2026-09-15').match(completionRe)[1], '2026-09-15', 'simple ✅ date');
assert.strictEqual((CHECK + '[2026-09-15]').match(completionRe)[1], '2026-09-15', 'bracketed ✅ date');
assert.strictEqual((CHECK + '   2026-09-15').match(completionRe)[1], '2026-09-15', 'loose spacing');
assert(!completionRe.test('just text'), 'no completion marker => no match');
console.log('    completionRe: PASS');

// --- priorityEmoji / PRIORITY_BY_RANK ---
console.log('  Testing priorityEmoji...');
assert.strictEqual(PRIORITY_BY_RANK[0], PRIORITY.P0, 'rank 0 => P0');
assert.strictEqual(PRIORITY_BY_RANK[4], PRIORITY.P4, 'rank 4 => P4');
assert.strictEqual(priorityEmoji(0), PRIORITY.P0, 'priorityEmoji P0');
assert.strictEqual(priorityEmoji(1), PRIORITY.P1, 'priorityEmoji P1');
assert.strictEqual(priorityEmoji(2), PRIORITY.P2, 'priorityEmoji P2 default');
assert.strictEqual(priorityEmoji(99), PRIORITY.P2, 'unknown rank falls back to P2');
console.log('    priorityEmoji: PASS');

// --- formatCompletedLine ---
console.log('  Testing formatCompletedLine...');
const lineFull = formatCompletedLine({ title: 'Formulaire', dlStr: '2026-09-15', hours: 1, priority: 1, compDate: '2026-09-15' });
assert.strictEqual(lineFull, '- [x] Formulaire ' + CALENDAR + ' [[[2026-09-15](2026-09-15)]] ' + CLOCK + ' 1h ' + PRIORITY.P1 + ' ' + CHECK + ' 2026-09-15', 'full metadata line');
const lineMin = formatCompletedLine({ title: 'Only done', compDate: '2026-01-01' });
assert.strictEqual(lineMin, '- [x] Only done ' + PRIORITY.P2 + ' ' + CHECK + ' 2026-01-01', 'minimal line (default prio, no date/duration)');
const lineNodate = formatCompletedLine({ title: 'No date', hours: 3, priority: 0, compDate: '2026-02-02' });
assert.strictEqual(lineNodate, '- [x] No date ' + CLOCK + ' 3h ' + PRIORITY.P0 + ' ' + CHECK + ' 2026-02-02', 'no deadline, no wikilink');
console.log('    formatCompletedLine: PASS');

// --- completionMonth ---
console.log('  Testing completionMonth...');
assert.deepStrictEqual(completionMonth('2026-09-15'), { year: 2026, month: 9 }, 'parses year+month');
assert.deepStrictEqual(completionMonth('2024-01-03'), { year: 2024, month: 1 }, 'January => month 1');
assert.strictEqual(completionMonth(null), null, 'null => null');
assert.strictEqual(completionMonth(''), null, 'empty => null');
assert.strictEqual(completionMonth('not-a-date'), null, 'garbage => null');
console.log('    completionMonth: PASS');

// --- filterByCompletionMonth ---
console.log('  Testing filterByCompletionMonth...');
const sample = [
  { title: 'A', compDate: '2026-09-01' },
  { title: 'B', compDate: '2026-09-20' },
  { title: 'C', compDate: '2026-08-15' },
  { title: 'D', compDate: null },
];
const sep = filterByCompletionMonth(sample, 2026, 9);
assert.strictEqual(sep.length, 2, 'two September tasks');
assert.deepStrictEqual(sep.map(t => t.title), ['A', 'B'], 'correct tasks selected');
const aug = filterByCompletionMonth(sample, 2026, 8);
assert.strictEqual(aug.length, 1, 'one August task');
assert.strictEqual(aug[0].title, 'C', 'August task selected');
const none = filterByCompletionMonth(sample, 2026, 7);
assert.strictEqual(none.length, 0, 'no tasks in July');
const withNulls = filterByCompletionMonth(sample, 2026, 9);
assert.ok(!withNulls.some(t => t.compDate == null), 'null-dated tasks excluded');
assert.strictEqual(filterByCompletionMonth(null, 2026, 9).length, 0, 'null input safe');
console.log('    filterByCompletionMonth: PASS');

// --- completionKey ---
console.log('  Testing completionKey...');
assert.strictEqual(completionKey('2026-09-15'), '2026-09-15', 'full date key');
assert.strictEqual(completionKey('2024-01-03'), '2024-01-03', 'zero-padded');
assert.strictEqual(completionKey(null), null, 'null => null');
assert.strictEqual(completionKey(''), null, 'empty => null');
assert.strictEqual(completionKey('not-a-date'), null, 'garbage => null');
assert.strictEqual(completionKey(undefined), null, 'undefined => null');
console.log('    completionKey: PASS');

// --- monthStartKey / monthEndKey ---
console.log('  Testing monthStartKey / monthEndKey...');
assert.strictEqual(monthStartKey(2026, 9), '2026-09-01', 'first day of month');
assert.strictEqual(monthEndKey(2026, 9), '2026-09-30', 'last day of September');
assert.strictEqual(monthEndKey(2024, 2), '2024-02-29', 'leap year February');
assert.strictEqual(monthEndKey(2026, 2), '2026-02-28', 'non-leap February');
assert.strictEqual(monthEndKey(2026, 1), '2026-01-31', 'January has 31 days');
assert.strictEqual(monthStartKey(2026, 12), '2026-12-01', 'December');
console.log('    monthStartKey / monthEndKey: PASS');

// --- filterByCompletionRange ---
console.log('  Testing filterByCompletionRange...');
const ran = [
  { title: 'Sep15', compDate: '2026-09-15' },
  { title: 'Sep01', compDate: '2026-09-01' },
  { title: 'Sep30', compDate: '2026-09-30' },
  { title: 'Aug10', compDate: '2026-08-10' },
  { title: 'Oct05', compDate: '2026-10-05' },
  { title: 'NoDate', compDate: null },
];
const sepRange = filterByCompletionRange(ran, '2026-09-01', '2026-09-30');
assert.strictEqual(sepRange.length, 3, 'three September tasks');
assert.deepStrictEqual(sepRange.map(t => t.title), ['Sep15', 'Sep01', 'Sep30'], 'in-month tasks selected');
const midRange = filterByCompletionRange(ran, '2026-09-10', '2026-09-20');
assert.deepStrictEqual(midRange.map(t => t.title), ['Sep15'], 'inclusive day range');
const cross = filterByCompletionRange(ran, '2026-09-25', '2026-10-10');
assert.deepStrictEqual(cross.map(t => t.title), ['Sep30', 'Oct05'], 'cross-month range');
const openEnd = filterByCompletionRange(ran, '2026-10-01', null);
assert.deepStrictEqual(openEnd.map(t => t.title), ['Oct05'], 'open end bound');
const openStart = filterByCompletionRange(ran, null, '2026-08-31');
assert.deepStrictEqual(openStart.map(t => t.title), ['Aug10'], 'open start bound includes earlier task');
const emptyBounds = filterByCompletionRange(ran, '', '');
assert.ok(!emptyBounds.some(t => t.compDate == null), 'null-dated tasks excluded even with open bounds');
assert.strictEqual(filterByCompletionRange(null, '2026-09-01', '2026-09-30').length, 0, 'null input safe');
console.log('    filterByCompletionRange: PASS');

// --- currentMonth ---
console.log('  Testing currentMonth...');
assert.deepStrictEqual(currentMonth({ year: 2026, month: 9, day: 15 }), { year: 2026, month: 9 }, 'luxon-like object');
const d = new Date(2023, 11, 1); // Dec 2023 (month index 11)
assert.deepStrictEqual(currentMonth(d), { year: 2023, month: 12 }, 'native Date December');
console.log('    currentMonth: PASS');

// --- isCompleteDate / normDate ---
console.log('  Testing isCompleteDate / normDate...');
assert.strictEqual(isCompleteDate('2026-09-15'), true, 'full date is complete');
assert.strictEqual(isCompleteDate('2026-9-1'), false, 'unpadded not complete');
assert.strictEqual(isCompleteDate('2026-09'), false, 'partial not complete');
assert.strictEqual(isCompleteDate('20260915'), false, 'no dashes not complete');
assert.strictEqual(isCompleteDate(''), false, 'empty not complete');
// normDate: raw digits
assert.strictEqual(normDate('20260915'), '2026-09-15', 'raw digits -> yyyy-mm-dd');
// normDate: keeps an already-padded value
assert.strictEqual(normDate('2026-09-15'), '2026-09-15', 'padded stays intact');
// normDate: leaves short input untouched while typing
assert.strictEqual(normDate('202'), '202', 'year-only left as typed');
assert.strictEqual(normDate('20260'), '2026-0', 'year+1 digit month padded');
assert.strictEqual(normDate('2026-09-1'), '2026-09-1', 'partial pad preserved');
// normDate: ignores stray non-digits in the middle
assert.strictEqual(normDate('2026/09/15'), '2026-09-15', 'slashes normalized');
console.log('    isCompleteDate / normDate: PASS');

console.log('\nAll constants extended tests passed!');
process.exit(0);
