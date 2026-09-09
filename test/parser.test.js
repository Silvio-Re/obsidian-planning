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

console.log('\nAll parser tests passed!');
process.exit(0);
