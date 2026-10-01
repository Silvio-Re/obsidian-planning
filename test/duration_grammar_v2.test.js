// Duration grammar v2 — matrix of cases validated during the design review.
// Covers: H:MM / HhMM compound time, min/d/j units, bare hours (default),
// comma decimals, case-insensitive units, and the guard rejections that
// prevent backtracking misparses (e.g. "⏱ 45 monkeys" must NOT become 4h).
import assert from 'assert';
import { CLOCK, durRe, ownDur, cleanTitle } from '../src/constants.js';

const DAY = 7.8; // USER_CONFIG.hoursPerDay default — 1d/1j unit

function mock(text) { return { text }; }

// --- H:MM / HhMM compound time ---
assert.strictEqual(ownDur(mock(CLOCK + ':: 2h30')), 2.5, '⏱:: 2h30');
assert.strictEqual(ownDur(mock(CLOCK + ' 2:30')), 2.5, '⏱ 2:30');
assert.strictEqual(ownDur(mock(CLOCK + ' 2h30')), 2.5, '⏱ 2h30');
assert.strictEqual(ownDur(mock(CLOCK + ':: 2:30')), 2.5, '⏱:: 2:30');
assert.strictEqual(ownDur(mock(CLOCK + ' 1:15')), 1.25, '⏱ 1:15');

// --- minutes unit ---
assert.strictEqual(ownDur(mock(CLOCK + ' 45 min')), 0.75, '⏱ 45 min');
assert.strictEqual(ownDur(mock(CLOCK + ' 45min')), 0.75, '⏱ 45min no space');
assert.strictEqual(ownDur(mock(CLOCK + ':: 30min')), 0.5, '⏱:: 30min');
assert.strictEqual(ownDur(mock(CLOCK + ' 90 minutes')), 1.5, '⏱ 90 minutes');
assert.strictEqual(ownDur(mock(CLOCK + ' 45 MIN')), 0.75, '⏱ 45 MIN case-insensitive');
assert.strictEqual(ownDur(mock(CLOCK + ' 30 minutes')), 0.5, '⏱ 30 minutes');

// --- day / jour unit (× hoursPerDay = 7.8) ---
assert.strictEqual(ownDur(mock(CLOCK + ' 2 d')), 2 * DAY, '⏱ 2 d');
assert.strictEqual(ownDur(mock(CLOCK + ' 2d')), 2 * DAY, '⏱ 2d no space');
assert.strictEqual(ownDur(mock(CLOCK + ' 2j')), 2 * DAY, '⏱ 2j');
assert.strictEqual(ownDur(mock(CLOCK + ' 2J')), 2 * DAY, '⏱ 2J case-insensitive');
assert.strictEqual(ownDur(mock(CLOCK + ' 2 jours')), 2 * DAY, '⏱ 2 jours');
assert.strictEqual(ownDur(mock(CLOCK + ' 1.5d')), 1.5 * DAY, '⏱ 1.5d decimal');
assert.strictEqual(ownDur(mock(CLOCK + ' 1 day')), DAY, '⏱ 1 day');

// --- bare number defaults to hours (max 2 integer digits) ---
assert.strictEqual(ownDur(mock(CLOCK + ' 4')), 4, '⏱ 4 = 4h');
assert.strictEqual(ownDur(mock(CLOCK + ':: 4')), 4, '⏱:: 4 = 4h');
assert.strictEqual(ownDur(mock(CLOCK + ' 9.75')), 9.75, '⏱ 9.75');
assert.strictEqual(ownDur(mock(CLOCK + ' 2,5')), 2.5, '⏱ 2,5 comma decimal');
assert.strictEqual(ownDur(mock(CLOCK + ' 2,5h')), 2.5, '⏱ 2,5h comma decimal + unit');
assert.strictEqual(ownDur(mock(CLOCK + ' 2H')), 2, '⏱ 2H case-insensitive');
assert.strictEqual(ownDur(mock(CLOCK + ' 4 (urgent)')), 4, '⏱ 4 followed by parenthetical');

// --- legacy h formats still work (regression) ---
assert.strictEqual(ownDur(mock(CLOCK + ' 3h')), 3, '⏱ 3h');
assert.strictEqual(ownDur(mock(CLOCK + ':: 24h')), 24, '⏱:: 24h');
assert.strictEqual(ownDur(mock('(' + CLOCK + ':: 0.25h)')), 0.25, '(⏱:: 0.25h)');
assert.strictEqual(ownDur(mock(CLOCK + '4h')), 4, '⏱4h no space');
assert.strictEqual(ownDur(mock(CLOCK + ' 0h')), 0, '⏱ 0h = 0');
assert.strictEqual(ownDur(mock(CLOCK + ':: 1000h')), 1000, '⏱:: 1000h large value');
assert.strictEqual(ownDur(mock(CLOCK + ' 3h pour le projet')), 3, 'unit mid-sentence');
assert.strictEqual(ownDur(mock(CLOCK + ' 2h, voir')), 2, 'unit followed by comma clause');
assert.strictEqual(ownDur(mock(CLOCK + ' 45 min for setup')), 0.75, 'min followed by prose');

// --- guard rejections: no silent misparse ---
assert.strictEqual(ownDur(mock(CLOCK + ' 2m')), 0, '⏱ 2m rejected (m is not minutes)');
assert.strictEqual(ownDur(mock(CLOCK + ':: 2m')), 0, '⏱:: 2m rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 2:75')), 0, '⏱ 2:75 invalid minutes');
assert.strictEqual(ownDur(mock(CLOCK + ' 2:305')), 0, '⏱ 2:305 trailing digits rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 2h30min')), 0, '⏱ 2h30min compound+unit rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 45 monkeys')), 0, '⏱ 45 monkeys not a duration (backtrack guard)');
assert.strictEqual(ownDur(mock(CLOCK + ' 4people')), 0, '⏱ 4people rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 3hello')), 0, '⏱ 3hello rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 2, avec Bob')), 0, '⏱ 2, avec Bob comma clause rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 4, urgent')), 0, '⏱ 4, urgent comma clause rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 2 janvier')), 0, '⏱ 2 janvier prose rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 100:30')), 0, '⏱ 100:30 3-digit hours rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 1430')), 0, '⏱ 1430 bare 4-digit rejected');
assert.strictEqual(ownDur(mock(CLOCK + ' 100')), 0, '⏱ 100 bare 3-digit rejected (unit required)');
assert.strictEqual(ownDur(mock(CLOCK + 'h')), 0, '⏱h no number');
assert.strictEqual(ownDur(mock(CLOCK + ' abc')), 0, '⏱ abc no number');
assert.strictEqual(ownDur(mock('no duration here')), 0, 'no duration');
assert.strictEqual(ownDur(mock('')), 0, 'empty text');

// --- durRe raw-match checks (matched span, for cleanTitle consumers) ---
assert(durRe.test(CLOCK + ' 2h30'), '⏱ 2h30 matches');
assert(!durRe.test(CLOCK + ' 2m'), '⏱ 2m does not match');
assert(!durRe.test(CLOCK + ' 45 monkeys'), '⏱ 45 monkeys does not match');

// --- cleanTitle strips every new form ---
assert.strictEqual(cleanTitle('Devis ' + CLOCK + ' 45 min'), 'Devis', 'cleanTitle strips ⏱ 45 min');
assert.strictEqual(cleanTitle('Devis ' + CLOCK + ' 2h30'), 'Devis', 'cleanTitle strips ⏱ 2h30');
assert.strictEqual(cleanTitle('Devis ' + CLOCK + ' 2 d'), 'Devis', 'cleanTitle strips ⏱ 2 d');
assert.strictEqual(cleanTitle('Devis ' + CLOCK + ' 2,5h'), 'Devis', 'cleanTitle strips ⏱ 2,5h');

console.log('  duration grammar v2 matrix: PASS');
