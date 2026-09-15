import assert from 'assert';
import { hasPriorityInversionAmongLate, findHighestPriorityEarliestDeadlineLate } from '../src/scheduler.js';

// --- Mock data ---
function task(startCal, endCal, priority, duration, title, path, line, late, deadline) {
  return { startCal, endCal, priority, duration, title, path, line, late: late ?? (endCal > startCal + 1), deadline: deadline ?? endCal };
}

// --- hasPriorityInversionAmongLate ---

console.log('Testing hasPriorityInversionAmongLate...');

// No late tasks
assert.strictEqual(hasPriorityInversionAmongLate([]), false, 'empty array');
assert.strictEqual(hasPriorityInversionAmongLate([task(0, 0.5, 1, 4, 'a', 'a', 1, false)]), false, 'one task, not late');

// Two late tasks, already in order (higher priority first) = no inversion
const s1 = [
  task(0, 2, 1, 2, 'a', 'a', 1, true),  // P1, late
  task(2, 4, 3, 2, 'b', 'b', 2, true),   // P3, late
];
assert.strictEqual(hasPriorityInversionAmongLate(s1), false, 'P1 before P3 = no inversion');

// Priority inversion: P3 scheduled before P1 among late tasks
const s2 = [
  task(0, 2, 3, 2, 'b', 'b', 2, true),   // P3, late — scheduled first
  task(2, 4, 1, 2, 'a', 'a', 1, true),   // P1, late — scheduled second (inversion!)
];
assert.strictEqual(hasPriorityInversionAmongLate(s2), true, 'P3 before P1 = inversion');

// Three late tasks: P2, P1, P3 — inversion at P1 before P3
const s3 = [
  task(0, 1, 2, 1, 'a', 'a', 1, true),
  task(1, 2, 1, 1, 'b', 'b', 2, true),
  task(2, 3, 3, 1, 'c', 'c', 3, true),
];
assert.strictEqual(hasPriorityInversionAmongLate(s3), true, 'P1 before P3 = inversion');

// Late + not-late mixed: only late tasks matter
const s4 = [
  task(0, 1, 3, 1, 'a', 'a', 1, true),
  task(1, 2, 1, 1, 'b', 'b', 2, false),
];
assert.strictEqual(hasPriorityInversionAmongLate(s4), false, 'only one late task');

console.log('  PASS');

// --- findHighestPriorityEarliestDeadlineLate ---

console.log('Testing findHighestPriorityEarliestDeadlineLate...');

const locked = new Set();

// Single late task
const r1 = findHighestPriorityEarliestDeadlineLate(
  [task(0, 2, 2, 4, 'a', 'a', 1, true)], locked
);
assert.strictEqual(r1.title, 'a', 'returns the only late task');

// Multiple late tasks, same priority — picks earliest deadline (not shortest)
const r2 = findHighestPriorityEarliestDeadlineLate([
  task(0, 3, 1, 3, 'big', 'big', 1, true),
  task(3, 5, 1, 2, 'small', 'small', 2, true),
], locked);
assert.strictEqual(r2.title, 'big', 'same P1: earliest deadline (end 3) wins over shorter task (end 5)');

// Different priorities among late tasks — picks highest (lowest number) regardless of size
const r3 = findHighestPriorityEarliestDeadlineLate([
  task(0, 2, 3, 1, 'low', 'low', 1, true),
  task(2, 6, 1, 4, 'high-p', 'high-p', 2, true),
], locked);
assert.strictEqual(r3.title, 'high-p', 'P1 beats P3 even if longer');

// Locked tasks are skipped
const r4 = findHighestPriorityEarliestDeadlineLate(
  [task(0, 1, 1, 2, 'locked-task', 'locked-task', 1, true), task(1, 3, 2, 1, 'open', 'open', 2, true)],
  new Set(['locked-task:1'])
);
assert.strictEqual(r4.title, 'open', 'skips locked task, picks next');

// No late tasks → null
const r5 = findHighestPriorityEarliestDeadlineLate([
  task(0, 1, 1, 1, 'a', 'a', 1, false),
  task(1, 2, 2, 1, 'b', 'b', 2, false),
], locked);
assert.strictEqual(r5, null, 'no late tasks returns null');

console.log('  PASS');

console.log('\nAll scheduler tests passed!');
process.exit(0);

// --- hasPriorityInversionAmongLate with more cases ---
console.log('Testing hasPriorityInversionAmongLate additional cases...');

// Three late tasks, all same priority — no inversion
const sInv = [
  task(0, 1, 2, 1, 'a', 1, true),
  task(1, 2, 2, 1, 'b', 2, true),
  task(2, 3, 2, 1, 'c', 3, true),
];
assert.strictEqual(hasPriorityInversionAmongLate(sInv), false, 'same priority no inversion');

// Two late with inversion, plus one not-late
const sInv2 = [
  task(0, 1, 3, 1, 'a', 1, true),
  task(1, 2, 1, 1, 'b', 2, true),  // P1 before P3 = inversion
  task(2, 3, 2, 1, 'c', 3, false), // not late, ignored
];
assert.strictEqual(hasPriorityInversionAmongLate(sInv2), true, 'inversion among late, ignore non-late');

// Non-late tasks don't cause false positive
const sInv3 = [
  task(0, 1, 3, 1, 'a', 1, false),
  task(1, 2, 1, 1, 'b', 2, false),
];
assert.strictEqual(hasPriorityInversionAmongLate(sInv3), false, 'no late = no inversion');

console.log('  Additional priority inversion: PASS');

// --- findHighestPriorityEarliestDeadlineLate edge cases ---
console.log('Testing findHighestPriorityEarliestDeadlineLate additional cases...');

// All tasks locked
const allLocked = new Set(['a:1', 'b:2', 'c:3']);
const rLock = findHighestPriorityEarliestDeadlineLate([
  task(0, 1, 1, 1, 'a', 'a', 1, true),
  task(1, 2, 2, 1, 'b', 'b', 2, true),
  task(2, 3, 3, 1, 'c', 'c', 3, true),
], allLocked);
assert.strictEqual(rLock, null, 'all locked returns null');

// Equal duration, same priority — returns first in array
const rEq = findHighestPriorityEarliestDeadlineLate([
  task(0, 1, 1, 2, 'first', 'a', 1, true),
  task(1, 2, 1, 2, 'second', 'b', 2, true),
], new Set());
assert.strictEqual(rEq.title, 'first', 'same priority+deadline: returns first');

// --- Regression: tie-break is earliest-deadline, NOT shortest-duration ---
console.log('Testing tie-break is earliest-deadline (regression)...');

// Same priority: the longer task with the EARLIER deadline must beat the shorter, later one.
const rReg = findHighestPriorityEarliestDeadlineLate([
  task(0, 5, 1, 5, 'long-early', 'a', 1, true, 3), // P1, dur 5h, deadline 3
  task(5, 6, 1, 1, 'short-late', 'b', 2, true, 7), // P1, dur 1h, deadline 7
], new Set());
assert.strictEqual(rReg.title, 'long-early', 'same P1: earliest deadline wins over shortest duration');

// Same priority, equal deadline — returns first in array (stable order)
const rRegEq = findHighestPriorityEarliestDeadlineLate([
  task(0, 2, 1, 2, 'x', 'a', 1, true, 4),
  task(2, 4, 1, 2, 'y', 'b', 2, true, 4),
], new Set());
assert.strictEqual(rRegEq.title, 'x', 'same priority+deadline: returns first');

console.log('  Tie-break regression: PASS');

console.log('  Additional findHighestPriority: PASS');

console.log('\nAll scheduler extended tests passed!');
