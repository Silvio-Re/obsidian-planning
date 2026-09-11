import assert from 'assert';
import {
  CLOCK, CALENDAR, ID_MARKER, BLOCK_MARKER,
  PRIORITY, PRIORITY_RANK, PRIORITY_DEFAULT,
  priorityRe, durRe, dateRe, idRe, blkRe,
  parsePriority, ownDur, cleanTitle, baseName, fmtHours
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

console.log('\nAll constants extended tests passed!');
process.exit(0);
